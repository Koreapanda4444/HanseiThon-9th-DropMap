import type { BindParameters } from "oracledb";
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

async function createOracleAccount(account: AccountCredential) {
  try {
    await withConnection(async (connection) => {
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
      await connection.commit();
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

function findLocalAccountByEmail(email: string) {
  return readLocalAccountData((data) => {
    const account = data.accounts.find((item) => item.email === email);
    return account ? toCredential(account) : null;
  });
}

function createLocalAccount(account: AccountCredential) {
  return mutateLocalAccountData((data) => {
    if (data.accounts.some((item) => item.email === account.email)) {
      throw new AppError("이미 사용 중인 이메일입니다.", 409, "EMAIL_ALREADY_USED");
    }
    data.accounts.push({ ...account });
    return publicAccount(account);
  });
}

function createLocalSession(tokenHash: string, userId: string, expiresAt: string) {
  return mutateLocalAccountData((data) => {
    const now = Date.now();
    data.sessions = data.sessions.filter((session) => Date.parse(session.expiresAt) > now);
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

export function findAccountByEmail(email: string) {
  return runWithDataSource(
    () => findOracleAccountByEmail(email),
    () => findLocalAccountByEmail(email),
  );
}

export function createAccount(account: AccountCredential) {
  return runWithDataSource(
    () => createOracleAccount(account),
    () => createLocalAccount(account),
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
