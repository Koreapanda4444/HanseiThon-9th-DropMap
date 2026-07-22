import { oracleConfigured } from "../config/env.js";
import { initializeLocalStore } from "../data-import/local-store.js";
import { checkDatabase, closeDatabase } from "../database/oracle.js";
import { AppError } from "../errors.js";

export type DataSourceMode = "oracle" | "local" | "unavailable";

interface DatabaseStatus {
  configured: boolean;
  connected: boolean;
  state: "unconfigured" | "disconnected" | "connected";
}

let mode: DataSourceMode | "uninitialized" = "uninitialized";
let initialization: Promise<void> | null = null;
let database: DatabaseStatus = {
  configured: oracleConfigured,
  connected: false,
  state: oracleConfigured ? "disconnected" : "unconfigured",
};

async function activateLocalStore() {
  try {
    await initializeLocalStore();
    mode = "local";
  } catch (error) {
    mode = "unavailable";
    console.error("Local data initialization failed", error);
  }
}

export async function initializeDataSource() {
  if (mode !== "uninitialized") return;
  initialization ??= (async () => {
    database = await checkDatabase();
    if (database.connected) {
      mode = "oracle";
      return;
    }
    await activateLocalStore();
  })();
  await initialization;
}

async function switchToLocal(error: unknown) {
  console.error("Oracle operation failed; switching data source", error);
  database = {
    configured: oracleConfigured,
    connected: false,
    state: oracleConfigured ? "disconnected" : "unconfigured",
  };
  await closeDatabase().catch((closeError) => {
    console.error("Oracle pool close failed", closeError);
  });
  await activateLocalStore();
}

function dataUnavailable() {
  return new AppError(
    "현재 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
    503,
    "DATA_UNAVAILABLE",
  );
}

export async function runWithDataSource<T>(
  oracleWork: () => Promise<T>,
  localWork: () => Promise<T>,
) {
  await initializeDataSource();
  if (mode === "oracle") {
    try {
      return await oracleWork();
    } catch (error) {
      if (error instanceof AppError && error.statusCode < 500) throw error;
      await switchToLocal(error);
    }
  }
  if (mode === "local") {
    return localWork();
  }
  throw dataUnavailable();
}

export async function getDataSourceStatus() {
  await initializeDataSource();
  return {
    mode: mode === "uninitialized" ? "unavailable" : mode,
    available: mode === "oracle" || mode === "local",
    database,
  };
}
