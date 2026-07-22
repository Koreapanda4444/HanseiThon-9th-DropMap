import { mutateLocalAccountData, readLocalAccountData, type StoredAccount } from "../data-import/local-account-store.js";
import { withConnection } from "../database/oracle.js";
import type { Account } from "../domain.js";
import { AppError } from "../errors.js";
import { runWithDataSource } from "../services/data-source.js";

export interface AccountCredential extends Account {
  passwordHash: string;
}

interface AccountRow {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: Date | string;
}

function toIsoString(value: Date | string) {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function toCredential(row: AccountRow | StoredAccount): AccountCredential {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    passwordHash: row.passwordHash,
    createdAt: toIsoString(row.createdAt),
  };
}

function publicAccount(account: AccountCredential): Account {
  const { passwordHash: _, ...result } = account;
  return result;
}

async function findOracleAccountByEmail(email: string) {
  return withConnection(async (connection) => {
    const result = await connection.execute<AccountRow>(`
      SELECT
        id "id",
        email "email",
        display_name "name",
        password_hash "passwordHash",
        created_at "createdAt"
      FROM users
      WHERE email = :email
    `, { email });
    const row = result.rows?.[0];
    return row ? toCredential(row) : null;
  });
}

async function createOracleAccountWithSession(
  account: AccountCredential,
  tokenHash: string,
  expiresAt: string,
) {
  try {
    await withConnection(async (connection) => {
      try {
        await connection.execute(`
          INSERT INTO users (id, email, display_name, password_hash, created_at, updated_at)
          VALUES (:id, :email, :name, :passwordHash, :createdAt, :createdAt)
        `, {
          id: account.id,
          email: account.email,
          name: account.name,
          passwordHash: account.passwordHash,
          createdAt: new Date(account.createdAt),
        });
        await connection.execute(`
          INSERT INTO auth_sessions (token_hash, user_id, expires_at)
          VALUES (:tokenHash, :userId, :expiresAt)
        `, { tokenHash, userId: account.id, expiresAt: new Date(expiresAt) });
        await connection.commit();
      } catch (error) {
        await connection.rollback().catch(() => undefined);
        throw error;
      }
    });
    return publicAccount(account);
  } catch (error) {
    if ((error as { errorNum?: number }).errorNum === 1) {
      throw new AppError("이미 사용 중인 이메일입니다.", 409, "EMAIL_ALREADY_USED");
    }
    throw error;
  }
}

async function createOracleSession(tokenHash: string, userId: string, expiresAt: string) {
  await withConnection(async (connection) => {
    await connection.execute("DELETE FROM auth_sessions WHERE expires_at <= SYSTIMESTAMP");
    await connection.execute(`
      DELETE FROM auth_sessions
      WHERE token_hash IN (
        SELECT token_hash
        FROM (
          SELECT token_hash, ROW_NUMBER() OVER (ORDER BY created_at DESC) session_rank
          FROM auth_sessions
          WHERE user_id = :userId
        )
        WHERE session_rank >= 10
      )
    `, { userId });
    await connection.execute(`
      INSERT INTO auth_sessions (token_hash, user_id, expires_at)
      VALUES (:tokenHash, :userId, :expiresAt)
    `, { tokenHash, userId, expiresAt: new Date(expiresAt) });
    await connection.commit();
  });
}

async function findOracleAccountBySession(tokenHash: string) {
  return withConnection(async (connection) => {
    const result = await connection.execute<AccountRow>(`
      SELECT
        u.id "id",
        u.email "email",
        u.display_name "name",
        u.password_hash "passwordHash",
        u.created_at "createdAt"
      FROM auth_sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = :tokenHash
        AND s.expires_at > SYSTIMESTAMP
    `, { tokenHash });
    const row = result.rows?.[0];
    return row ? publicAccount(toCredential(row)) : null;
  });
}

async function deleteOracleSession(tokenHash: string) {
  await withConnection(async (connection) => {
    await connection.execute("DELETE FROM auth_sessions WHERE token_hash = :tokenHash", { tokenHash });
    await connection.commit();
  });
}

async function updateOraclePasswordAndDeleteSessions(userId: string, passwordHash: string) {
  await withConnection(async (connection) => {
    await connection.execute(`
      UPDATE users
      SET password_hash = :passwordHash, updated_at = SYSTIMESTAMP
      WHERE id = :userId
    `, { userId, passwordHash });
    await connection.execute("DELETE FROM auth_sessions WHERE user_id = :userId", { userId });
    await connection.commit();
  });
}

async function deleteOracleAccount(userId: string) {
  await withConnection(async (connection) => {
    await connection.execute("DELETE FROM users WHERE id = :userId", { userId });
    await connection.commit();
  });
}

function findLocalAccountByEmail(email: string) {
  return readLocalAccountData((data) => {
    const account = data.accounts.find((item) => item.email === email);
    return account ? toCredential(account) : null;
  });
}

function createLocalAccountWithSession(
  account: AccountCredential,
  tokenHash: string,
  expiresAt: string,
) {
  return mutateLocalAccountData((data) => {
    if (data.accounts.some((item) => item.email === account.email)) {
      throw new AppError("이미 사용 중인 이메일입니다.", 409, "EMAIL_ALREADY_USED");
    }
    data.accounts.push({ ...account });
    data.sessions.push({
      tokenHash,
      userId: account.id,
      expiresAt,
      createdAt: new Date().toISOString(),
    });
    return publicAccount(account);
  });
}

function createLocalSession(tokenHash: string, userId: string, expiresAt: string) {
  return mutateLocalAccountData((data) => {
    const now = Date.now();
    data.sessions = data.sessions.filter((session) => Date.parse(session.expiresAt) > now);
    const recentSessions = data.sessions
      .filter((session) => session.userId === userId)
      .sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt))
      .slice(0, 9);
    data.sessions = data.sessions.filter((session) => session.userId !== userId).concat(recentSessions);
    data.sessions.push({ tokenHash, userId, expiresAt, createdAt: new Date().toISOString() });
  });
}

function findLocalAccountBySession(tokenHash: string) {
  return readLocalAccountData((data) => {
    const session = data.sessions.find((item) => item.tokenHash === tokenHash && Date.parse(item.expiresAt) > Date.now());
    if (!session) return null;
    const account = data.accounts.find((item) => item.id === session.userId);
    return account ? publicAccount(toCredential(account)) : null;
  });
}

function deleteLocalSession(tokenHash: string) {
  return mutateLocalAccountData((data) => {
    data.sessions = data.sessions.filter((session) => session.tokenHash !== tokenHash);
  });
}

function updateLocalPasswordAndDeleteSessions(userId: string, passwordHash: string) {
  return mutateLocalAccountData((data) => {
    const account = data.accounts.find((item) => item.id === userId);
    if (!account) throw new AppError("계정을 찾을 수 없습니다.", 404, "ACCOUNT_NOT_FOUND");
    account.passwordHash = passwordHash;
    data.sessions = data.sessions.filter((session) => session.userId !== userId);
  });
}

function deleteLocalAccount(userId: string) {
  return mutateLocalAccountData((data) => {
    data.accounts = data.accounts.filter((account) => account.id !== userId);
    data.sessions = data.sessions.filter((session) => session.userId !== userId);
    data.reports = data.reports.filter((report) => report.userId !== userId);
  });
}

export function findAccountByEmail(email: string) {
  return runWithDataSource(
    () => findOracleAccountByEmail(email),
    () => findLocalAccountByEmail(email),
  );
}

export function createAccountWithSession(
  account: AccountCredential,
  tokenHash: string,
  expiresAt: string,
) {
  return runWithDataSource(
    () => createOracleAccountWithSession(account, tokenHash, expiresAt),
    () => createLocalAccountWithSession(account, tokenHash, expiresAt),
  );
}

export function createSession(tokenHash: string, userId: string, expiresAt: string) {
  return runWithDataSource(
    () => createOracleSession(tokenHash, userId, expiresAt),
    () => createLocalSession(tokenHash, userId, expiresAt),
  );
}

export function findAccountBySession(tokenHash: string) {
  return runWithDataSource(
    () => findOracleAccountBySession(tokenHash),
    () => findLocalAccountBySession(tokenHash),
  );
}

export function deleteSession(tokenHash: string) {
  return runWithDataSource(
    () => deleteOracleSession(tokenHash),
    () => deleteLocalSession(tokenHash),
  );
}

export function updatePasswordAndDeleteSessions(userId: string, passwordHash: string) {
  return runWithDataSource(
    () => updateOraclePasswordAndDeleteSessions(userId, passwordHash),
    () => updateLocalPasswordAndDeleteSessions(userId, passwordHash),
  );
}

export function deleteAccount(userId: string) {
  return runWithDataSource(
    () => deleteOracleAccount(userId),
    () => deleteLocalAccount(userId),
  );
}
