import cors from "@fastify/cors";
import Fastify from "fastify";
import { ZodError } from "zod";
import { corsOrigins } from "./config/env.js";
import { AppError } from "./errors.js";
import { facilityRoutes } from "./routes/facilities.js";
import { healthRoutes } from "./routes/health.js";
import { kakaoRoutes } from "./routes/kakao.js";
import { reportRoutes } from "./routes/reports.js";
import { wasteRoutes } from "./routes/waste.js";

export async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: (origin, callback) => {
      if (!origin || corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin not allowed"), false);
    },
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "요청값을 확인해 주세요.",
          details: error.issues,
        },
      });
    }

    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: { code: error.code, message: error.message, details: error.details },
      });
    }

    request.log.error(error);
    return reply.status(500).send({
      error: { code: "INTERNAL_SERVER_ERROR", message: "서버에서 요청을 처리하지 못했습니다." },
    });
  });

  app.setNotFoundHandler((request, reply) => {
    return reply.status(404).send({
      error: { code: "ROUTE_NOT_FOUND", message: "요청한 API 경로를 찾을 수 없습니다." },
    });
  });

  await app.register(healthRoutes);
  await app.register(facilityRoutes);
  await app.register(wasteRoutes);
  await app.register(reportRoutes);
  await app.register(kakaoRoutes);

  return app;
}
