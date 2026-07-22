import oracledb, { type Connection, type Pool } from "oracledb";
import { env, oracleConfigured, oracleConnectString } from "../config/env.js";
import { AppError } from "../errors.js";

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

let pool: Pool | null = null;
let poolPromise: Promise<Pool> | null = null;
let closingPromise: Promise<void> | null = null;

async function createPool() {
  if (!oracleConfigured) {
    throw new AppError(
      "현재 데이터를 불러오지 못했습니다.",
      503,
      "DATABASE_NOT_CONFIGURED",
    );
  }

  return oracledb.createPool({
    user: env.ORACLE_USER,
    password: env.ORACLE_PASSWORD,
    connectString: oracleConnectString,
    poolMin: env.ORACLE_POOL_MIN,
    poolMax: env.ORACLE_POOL_MAX,
    poolIncrement: env.ORACLE_POOL_INCREMENT,
    queueTimeout: 5000,
  });
}

async function getPool() {
  if (closingPromise) await closingPromise;
  if (pool) return pool;
  const pending = poolPromise ?? createPool();
  poolPromise = pending;
  try {
    const created = await pending;
    pool = created;
    return created;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("현재 데이터를 불러오지 못했습니다.", 503, "DATABASE_UNAVAILABLE");
  } finally {
    if (poolPromise === pending) poolPromise = null;
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
    return { configured: true, connected: false, state: "disconnected" as const };
  }
}

export async function closeDatabase() {
  if (closingPromise) return closingPromise;
  const task = (async () => {
    const pending = poolPromise;
    if (pending) await pending.catch(() => undefined);
    const activePool = pool;
    pool = null;
    if (activePool) await activePool.close(10);
  })();
  closingPromise = task;
  try {
    await task;
  } finally {
    if (closingPromise === task) closingPromise = null;
  }
}
