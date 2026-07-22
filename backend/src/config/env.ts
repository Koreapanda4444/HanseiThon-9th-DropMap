import "dotenv/config";
import { z } from "zod";

const emptyToUndefined = (value: unknown) => (
  typeof value === "string" && value.trim() === "" ? undefined : value
);

const optionalText = z.preprocess(
  emptyToUndefined,
  z.string().trim().min(1).optional(),
);

const textWithDefault = (fallback: string) => z.preprocess(
  emptyToUndefined,
  z.string().trim().min(1).default(fallback),
);

const numberWithDefault = (fallback: number, minimum: number, maximum?: number) => z.preprocess(
  emptyToUndefined,
  z.coerce.number().int().min(minimum).max(maximum ?? Number.MAX_SAFE_INTEGER).default(fallback),
);

const schema = z.object({
  NODE_ENV: z.preprocess(
    emptyToUndefined,
    z.enum(["development", "test", "production"]).default("development"),
  ),
  HOST: textWithDefault("0.0.0.0"),
  PORT: numberWithDefault(4000, 1, 65535),
  CORS_ORIGIN: textWithDefault("http://localhost:3000,http://127.0.0.1:3000"),
  ORACLE_HOST: optionalText,
  ORACLE_PORT: numberWithDefault(1521, 1, 65535),
  ORACLE_USER: optionalText,
  ORACLE_PASSWORD: optionalText,
  ORACLE_SERVICE_NAME: optionalText,
  ORACLE_POOL_MIN: numberWithDefault(1, 0),
  ORACLE_POOL_MAX: numberWithDefault(5, 1),
  ORACLE_POOL_INCREMENT: numberWithDefault(1, 1),
  KAKAO_REST_API_KEY: optionalText,
  KAKAO_NATIVE_APP_KEY: optionalText,
});

export const env = schema.parse(process.env);

export const oracleConfigured = Boolean(
  env.ORACLE_HOST
  && env.ORACLE_USER
  && env.ORACLE_PASSWORD
  && env.ORACLE_SERVICE_NAME,
);

export const oracleConnectString = env.ORACLE_HOST && env.ORACLE_SERVICE_NAME
  ? `${env.ORACLE_HOST}:${env.ORACLE_PORT}/${env.ORACLE_SERVICE_NAME}`
  : "";

export const corsOrigins = env.CORS_ORIGIN
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
