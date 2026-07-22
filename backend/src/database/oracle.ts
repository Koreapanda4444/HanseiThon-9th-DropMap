import oracledb, { type Connection, type Pool } from "oracledb";
import { env, oracleConfigured, oracleConnectString } from "../config/env.js";
import { AppError } from "../errors.js";

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

let pool: Pool | null = null;
let connectionState: "unconfigured" | "disconnected" | "connected" = oracleConfigured
  ? "disconnected"
  : "unconfigured";

async function createPool() {
  if (!oracleConfigured) {
    throw new AppError(
      "현재 데이터를 불러오지 못했습니다.",
      503,
      "DATABASE_NOT_CONFIGURED",
    );
  }

  pool = await oracledb.createPool({
    user: env.ORACLE_USER,
    password: env.ORACLE_PASSWORD,
    connectString: oracleConnectString,
    poolMin: env.ORACLE_POOL_MIN,
    poolMax: env.ORACLE_POOL_MAX,
    poolIncrement: env.ORACLE_POOL_INCREMENT,
    queueTimeout: 5000,
  });
  connectionState = "connected";
  return pool;
}

async function getPool() {
  if (pool) return pool;
  try {
    return await createPool();
  } catch (error) {
    if (error instanceof AppError) throw error;
    connectionState = "disconnected";
    throw new AppError("현재 데이터를 불러오지 못했습니다.", 503, "DATABASE_UNAVAILABLE");
  }
}

export async function withConnection<T>(work: (connection: Connection) => Promise<T>) {
  const activePool = await getPool();
  const connection = await activePool.getConnection();
  try {
    return await work(connection);
  } finally {
    await connection.close();
  }
}

export async function checkDatabase() {
  if (!oracleConfigured) {
    return { configured: false, connected: false, state: "unconfigured" as const };
  }

  try {
    await withConnection(async (connection) => {
      await connection.execute("SELECT 1 FROM DUAL");
    });
    return { configured: true, connected: true, state: "connected" as const };
  } catch {
    connectionState = "disconnected";
    return { configured: true, connected: false, state: "disconnected" as const };
  }
}

export async function closeDatabase() {
  if (!pool) return;
  await pool.close(10);
  pool = null;
  connectionState = oracleConfigured ? "disconnected" : "unconfigured";
}
