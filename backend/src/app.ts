import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify, { LogController } from "fastify";
import { ZodError } from "zod";
import { corsOrigins, env } from "./config/env.js";
import { AppError } from "./errors.js";
import { analysisRoutes } from "./routes/analysis.js";
import { authRoutes } from "./routes/auth.js";
import { facilityRoutes } from "./routes/facilities.js";
import { healthRoutes } from "./routes/health.js";
import { kakaoRoutes } from "./routes/kakao.js";
import { reportRoutes } from "./routes/reports.js";
import { wasteRoutes } from "./routes/waste.js";

export async function buildApp() {
  const app = Fastify({
    logger: env.NODE_ENV === "test" ? false : {
      level: env.NODE_ENV === "production" ? "info" : "debug",
      redact: {
        paths: [
          "req.headers.authorization",
          "req.headers.cookie",
          "res.headers.set-cookie",
          "password",
          "currentPassword",
          "newPassword",
          "image",
          "req.body.password",
          "req.body.currentPassword",
          "req.body.newPassword",
          "req.body.image",
        ],
        censor: "[REDACTED]",
      },
    },
    logController: new LogController({ disableRequestLogging: true }),
    bodyLimit: 512 * 1024,
    connectionTimeout: 10_000,
    requestTimeout: 20_000,
    keepAliveTimeout: 72_000,
    trustProxy: env.TRUST_PROXY,
    onProtoPoisoning: "error",
    onConstructorPoisoning: "error",
  });

  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false,
    frameguard: { action: "deny" },
    strictTransportSecurity: env.NODE_ENV === "production"
      ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
      : false,
  });

  await app.register(rateLimit, {
    global: true,
    max: 180,
    timeWindow: "1 minute",
    keyGenerator: (request) => request.ip,
    errorResponseBuilder: () => ({
      error: {
        code: "RATE_LIMITED",
        message: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
      },
    }),
  });

  await app.register(cors, {
    origin: (origin, callback) => {
      if (!origin || corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new AppError("허용되지 않은 요청입니다.", 403, "ORIGIN_NOT_ALLOWED"), false);
    },
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Accept", "Content-Type", "X-Requested-With"],
    exposedHeaders: ["X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset", "Retry-After", "X-Request-Id"],
    maxAge: 600,
    strictPreflight: true,
  });

  app.addHook("onRequest", async (request, reply) => {
    reply.header("X-Request-Id", String(request.id));
    reply.header("X-Robots-Tag", "noindex, nofollow");
    const stateChanging = !["GET", "HEAD", "OPTIONS"].includes(request.method);
    const privateRequest = request.url.startsWith("/api/auth/") || request.url.startsWith("/api/reports");
    if (privateRequest || stateChanging) {
      reply.header("Cache-Control", "no-store");
      reply.header("Pragma", "no-cache");
    }
    if (!stateChanging || !request.url.startsWith("/api/")) return;
    const origin = request.headers.origin;
    if (origin && !corsOrigins.includes(origin)) {
      throw new AppError("허용되지 않은 요청입니다.", 403, "ORIGIN_NOT_ALLOWED");
    }
    if (request.headers["x-requested-with"] !== "beoril-map") {
      throw new AppError("요청을 확인할 수 없습니다.", 403, "CSRF_CHECK_FAILED");
    }
  });

  app.addHook("onResponse", async (request, reply) => {
    request.log.info({
      method: request.method,
      route: request.routeOptions.url,
      statusCode: reply.statusCode,
      responseTimeMs: Math.round(reply.elapsedTime),
    }, "request completed");
  });

  app.setErrorHandler((error, request, reply) => {
    const statusCode = typeof error === "object" && error !== null && "statusCode" in error
      ? (error as { statusCode?: unknown }).statusCode
      : undefined;
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "요청값을 확인해 주세요.",
          ...(env.NODE_ENV === "development" ? {
            details: error.issues.map((issue) => ({ path: issue.path, message: issue.message })),
          } : {}),
        },
      });
    }

    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          ...(env.NODE_ENV === "development" && error.details !== undefined ? { details: error.details } : {}),
        },
      });
    }

    if (statusCode === 400) {
      return reply.status(400).send({ error: { code: "INVALID_REQUEST", message: "요청 형식을 확인해 주세요." } });
    }
    if (statusCode === 413) {
      return reply.status(413).send({ error: { code: "PAYLOAD_TOO_LARGE", message: "전송할 데이터의 크기가 너무 큽니다." } });
    }
    if (statusCode === 415) {
      return reply.status(415).send({ error: { code: "UNSUPPORTED_MEDIA_TYPE", message: "지원하지 않는 요청 형식입니다." } });
    }
    if (statusCode === 429) {
      return reply.status(429).send({ error: { code: "RATE_LIMITED", message: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." } });
    }

    request.log.error({ err: error, route: request.routeOptions.url }, "request failed");
    return reply.status(500).send({
      error: { code: "INTERNAL_SERVER_ERROR", message: "서버에서 요청을 처리하지 못했습니다." },
    });
  });

  app.setNotFoundHandler((_request, reply) => {
    return reply.status(404).send({
      error: { code: "ROUTE_NOT_FOUND", message: "요청한 API 경로를 찾을 수 없습니다." },
    });
  });

  await app.register(healthRoutes);
  await app.register(analysisRoutes);
  await app.register(authRoutes);
  await app.register(facilityRoutes);
  await app.register(wasteRoutes);
  await app.register(reportRoutes);
  await app.register(kakaoRoutes);

  return app;
}
