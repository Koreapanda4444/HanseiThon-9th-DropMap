import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import type { FastifyRequest } from "fastify";
import { env } from "../config/env.js";
import type { Account } from "../domain.js";
import { AppError } from "../errors.js";
import {
  createAccountWithSession,
  createSession,
  deleteAccount,
  deleteSession,
  findAccountByEmail,
  findAccountBySession,
  updatePasswordAndDeleteSessions,
} from "../repositories/account-repository.js";

export const sessionCookieName = env.NODE_ENV === "production" ? "__Host-beoril_session" : "beoril_session";
export const sessionMaxAgeSeconds = 60 * 60 * 24 * 7;

function deriveKey(password: string, salt: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, 64, (error, key) => {
      if (error) reject(error);
      else resolve(key as Buffer);
    });
  });
}

async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt);
  return `scrypt:${salt.toString("hex")}:${key.toString("hex")}`;
}

let dummyPasswordHashPromise: Promise<string> | null = null;

function dummyPasswordHash() {
  dummyPasswordHashPromise ??= hashPassword(randomBytes(32).toString("base64url"));
  return dummyPasswordHashPromise;
}

async function passwordMatches(password: string, stored: string) {
  const [algorithm, saltHex, keyHex] = stored.split(":");
  if (algorithm !== "scrypt" || !saltHex || !keyHex || !/^[a-f0-9]{32}$/.test(saltHex) || !/^[a-f0-9]{128}$/.test(keyHex)) return false;
  const expected = Buffer.from(keyHex, "hex");
  const actual = await deriveKey(password, Buffer.from(saltHex, "hex"));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function normalizedEmail(email: string) {
  return email.trim().toLocaleLowerCase("en-US");
}

export function sessionCookie(token: string) {
  const secure = env.NODE_ENV === "production" ? "; Secure" : "";
  return `${sessionCookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Priority=High; Max-Age=${sessionMaxAgeSeconds}${secure}`;
}

export function expiredSessionCookie() {
  const secure = env.NODE_ENV === "production" ? "; Secure" : "";
  return `${sessionCookieName}=; Path=/; HttpOnly; SameSite=Strict; Priority=High; Max-Age=0${secure}`;
}

export function sessionToken(request: FastifyRequest) {
  const cookie = request.headers.cookie;
  if (!cookie) return null;
  for (const pair of cookie.split(";")) {
    const [name, ...parts] = pair.trim().split("=");
    if (name !== sessionCookieName) continue;
    try {
      const token = decodeURIComponent(parts.join("="));
      return /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
    } catch {
      return null;
    }
  }
  return null;
}

async function issueSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + sessionMaxAgeSeconds * 1000).toISOString();
  await createSession(tokenHash(token), userId, expiresAt);
  return token;
}

export async function register(input: { name: string; email: string; password: string }) {
  const email = normalizedEmail(input.email);
  if (await findAccountByEmail(email)) {
    throw new AppError("이미 사용 중인 이메일입니다.", 409, "EMAIL_ALREADY_USED");
  }
  const createdAt = new Date().toISOString();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + sessionMaxAgeSeconds * 1000).toISOString();
  const account = await createAccountWithSession({
    id: randomUUID(),
    email,
    name: input.name.trim(),
    passwordHash: await hashPassword(input.password),
    createdAt,
  }, tokenHash(token), expiresAt);
  return { account, token };
}

export async function login(input: { email: string; password: string }) {
  const account = await findAccountByEmail(normalizedEmail(input.email));
  const passwordHash = account?.passwordHash ?? await dummyPasswordHash();
  const matches = await passwordMatches(input.password, passwordHash);
  if (!account || !matches) {
    throw new AppError("이메일 또는 비밀번호를 확인해 주세요.", 401, "INVALID_CREDENTIALS");
  }
  const { passwordHash: _, ...publicAccount } = account;
  return { account: publicAccount, token: await issueSession(account.id) };
}

export async function currentAccount(request: FastifyRequest): Promise<Account | null> {
  const token = sessionToken(request);
  return token ? findAccountBySession(tokenHash(token)) : null;
}

export async function requireAccount(request: FastifyRequest) {
  const account = await currentAccount(request);
  if (!account) throw new AppError("로그인이 필요한 기능입니다.", 401, "AUTH_REQUIRED");
  return account;
}

export async function logout(request: FastifyRequest) {
  const token = sessionToken(request);
  if (token) await deleteSession(tokenHash(token));
}

async function verifiedAccount(request: FastifyRequest, password: string) {
  const account = await requireAccount(request);
  const credential = await findAccountByEmail(account.email);
  if (!credential || !await passwordMatches(password, credential.passwordHash)) {
    throw new AppError("현재 비밀번호가 올바르지 않습니다.", 401, "INVALID_PASSWORD");
  }
  return { account, credential };
}

export async function changePassword(request: FastifyRequest, input: { currentPassword: string; newPassword: string }) {
  const { account, credential } = await verifiedAccount(request, input.currentPassword);
  if (await passwordMatches(input.newPassword, credential.passwordHash)) {
    throw new AppError("새 비밀번호는 현재 비밀번호와 다르게 입력해 주세요.", 400, "PASSWORD_UNCHANGED");
  }
  await updatePasswordAndDeleteSessions(account.id, await hashPassword(input.newPassword));
  return { token: await issueSession(account.id) };
}

export async function removeAccount(request: FastifyRequest, password: string) {
  const { account } = await verifiedAccount(request, password);
  await deleteAccount(account.id);
}
