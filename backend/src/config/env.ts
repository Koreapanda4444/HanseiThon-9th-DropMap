import { config } from "dotenv";
import { z } from "zod";

config({ path: ".env", quiet: true });

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

const booleanWithDefault = (fallback: boolean) => z.preprocess(
  (value) => {
    if (typeof value !== "string") return value ?? fallback;
    const normalized = value.trim().toLowerCase();
    if (!normalized) return fallback;
    if (["true", "1", "yes"].includes(normalized)) return true;
    if (["false", "0", "no"].includes(normalized)) return false;
    return value;
  },
  z.boolean().default(fallback),
);

function validOrigins(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean).every((origin) => {
    try {
      const url = new URL(origin);
      return ["http:", "https:"].includes(url.protocol)
        && url.origin === origin.replace(/\/$/, "")
        && !url.username
        && !url.password;
    } catch {
      return false;
    }
  });
}

const schema = z.object({
  NODE_ENV: z.preprocess(
    emptyToUndefined,
    z.enum(["development", "test", "production"]).default("development"),
  ),
  HOST: textWithDefault("0.0.0.0"),
  PORT: numberWithDefault(4000, 1, 65535),
  TRUST_PROXY: booleanWithDefault(false),
  CORS_ORIGIN: textWithDefault("http://localhost:3000,http://127.0.0.1:3000").refine(validOrigins),
  ORACLE_HOST: z.preprocess(emptyToUndefined, z.string().trim().regex(/^[A-Za-z0-9._:-]+$/).optional()),
  ORACLE_PORT: numberWithDefault(1521, 1, 65535),
  ORACLE_USER: optionalText,
  ORACLE_PASSWORD: optionalText,
  ORACLE_SERVICE_NAME: z.preprocess(emptyToUndefined, z.string().trim().regex(/^[A-Za-z0-9._-]+$/).optional()),
  ORACLE_POOL_MIN: numberWithDefault(1, 0, 100),
  ORACLE_POOL_MAX: numberWithDefault(5, 1, 100),
  ORACLE_POOL_INCREMENT: numberWithDefault(1, 1, 100),
  KAKAO_REST_API_KEY: optionalText,
  KAKAO_NATIVE_APP_KEY: optionalText,
  IMPORT_CSV_DIR: optionalText,
  LOCAL_ACCOUNT_FILE: optionalText,
  NEKOS_API_KEY: optionalText,
  NEKOS_BASE_URL: textWithDefault("https://codex.nekos.me/v1").refine((value) => {
    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  }),
  NEKOS_VISION_MODEL: textWithDefault("gpt-5.4-mini"),
}).superRefine((value, context) => {
  if (value.ORACLE_POOL_MIN > value.ORACLE_POOL_MAX) {
    context.addIssue({ code: "custom", path: ["ORACLE_POOL_MIN"], message: "ORACLE_POOL_MIN must not exceed ORACLE_POOL_MAX" });
  }
  if (value.ORACLE_POOL_INCREMENT > value.ORACLE_POOL_MAX) {
    context.addIssue({ code: "custom", path: ["ORACLE_POOL_INCREMENT"], message: "ORACLE_POOL_INCREMENT must not exceed ORACLE_POOL_MAX" });
  }
});

export const env = schema.parse(process.env);

export const oracleConfigured = Boolean(
  env.ORACLE_HOST
  && env.ORACLE_USER
  && env.ORACLE_PASSWORD
  && env.ORACLE_SERVICE_NAME,
);

export const oracleConnectString = env.ORACLE_HOST && env.ORACLE_SERVICE_NAME
  ? `(DESCRIPTION=(CONNECT_TIMEOUT=5)(TRANSPORT_CONNECT_TIMEOUT=3)(RETRY_COUNT=0)(ADDRESS=(PROTOCOL=TCP)(HOST=${env.ORACLE_HOST})(PORT=${env.ORACLE_PORT}))(CONNECT_DATA=(SERVICE_NAME=${env.ORACLE_SERVICE_NAME})))`
  : "";

export const corsOrigins = env.CORS_ORIGIN
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
