import { chmod, mkdir, open, rename, unlink, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { z } from "zod";
import { env } from "../config/env.js";
import { reportTypes, type ReportStatus, type ReportType } from "../domain.js";
import { AppError } from "../errors.js";

export interface StoredAccount {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: string;
}

export interface StoredSession {
  tokenHash: string;
  userId: string;
  expiresAt: string;
  createdAt: string;
}

export interface StoredReport {
  id: string;
  userId: string;
  facilityId: string;
  reportType: ReportType;
  content: string;
  status: ReportStatus;
  createdAt: string;
  updatedAt: string;
}

export interface LocalAccountData {
  accounts: StoredAccount[];
  sessions: StoredSession[];
  reports: StoredReport[];
}

const filePath = resolve(env.LOCAL_ACCOUNT_FILE ?? ".local-data/accounts.json");
const maximumFileBytes = 64 * 1024 * 1024;
let snapshot: LocalAccountData | null = null;
let queue: Promise<unknown> = Promise.resolve();

const isoDate = z.string().max(40).refine((value) => Number.isFinite(Date.parse(value)));
const accountSchema = z.object({
  id: z.uuid(),
  email: z.email().max(254),
  name: z.string().trim().min(1).max(30),
  passwordHash: z.string().regex(/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/),
  createdAt: isoDate,
}).strict();
const sessionSchema = z.object({
  tokenHash: z.string().regex(/^[a-f0-9]{64}$/),
  userId: z.uuid(),
  expiresAt: isoDate,
  createdAt: isoDate,
}).strict();
const reportSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  facilityId: z.string().regex(/^\d{1,38}$/),
  reportType: z.enum(reportTypes),
  content: z.string().min(1).max(1000),
  status: z.enum(["received", "reviewing", "resolved"]),
  createdAt: isoDate,
  updatedAt: isoDate,
}).strict();
const localAccountDataSchema = z.object({
  accounts: z.array(accountSchema).max(100_000),
  sessions: z.array(sessionSchema).max(1_000_000),
  reports: z.array(reportSchema).max(1_000_000),
}).strict().superRefine((data, context) => {
  const accountIds = new Set<string>();
  const emails = new Set<string>();
  data.accounts.forEach((account, index) => {
    if (accountIds.has(account.id)) context.addIssue({ code: "custom", path: ["accounts", index, "id"], message: "duplicate account id" });
    if (emails.has(account.email)) context.addIssue({ code: "custom", path: ["accounts", index, "email"], message: "duplicate email" });
    accountIds.add(account.id);
    emails.add(account.email);
  });
  const tokenHashes = new Set<string>();
  data.sessions.forEach((session, index) => {
    if (!accountIds.has(session.userId)) context.addIssue({ code: "custom", path: ["sessions", index, "userId"], message: "unknown account" });
    if (tokenHashes.has(session.tokenHash)) context.addIssue({ code: "custom", path: ["sessions", index, "tokenHash"], message: "duplicate session" });
    tokenHashes.add(session.tokenHash);
  });
  const reportIds = new Set<string>();
  data.reports.forEach((report, index) => {
    if (!accountIds.has(report.userId)) context.addIssue({ code: "custom", path: ["reports", index, "userId"], message: "unknown account" });
    if (reportIds.has(report.id)) context.addIssue({ code: "custom", path: ["reports", index, "id"], message: "duplicate report" });
    reportIds.add(report.id);
  });
});

function emptyData(): LocalAccountData {
  return { accounts: [], sessions: [], reports: [] };
}

async function loadData() {
  if (snapshot) return snapshot;
  try {
    const handle = await open(filePath, "r");
    let text: string;
    try {
      const stats = await handle.stat();
      if (!stats.isFile() || stats.size > maximumFileBytes) {
        throw new AppError("계정 데이터를 불러오지 못했습니다.", 503, "LOCAL_ACCOUNT_DATA_INVALID");
      }
      const contents = await handle.readFile();
      if (contents.byteLength > maximumFileBytes) {
        throw new AppError("계정 데이터를 불러오지 못했습니다.", 503, "LOCAL_ACCOUNT_DATA_INVALID");
      }
      text = contents.toString("utf8");
    } finally {
      await handle.close();
    }
    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new AppError("계정 데이터를 불러오지 못했습니다.", 503, "LOCAL_ACCOUNT_DATA_INVALID");
    }
    const parsed = localAccountDataSchema.safeParse(payload);
    if (!parsed.success) {
      throw new AppError("계정 데이터를 불러오지 못했습니다.", 503, "LOCAL_ACCOUNT_DATA_INVALID");
    }
    snapshot = parsed.data;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    snapshot = emptyData();
  }
  return snapshot;
}

function serialize<T>(work: () => Promise<T>) {
  const active = queue.then(work, work);
  queue = active.then(() => undefined, () => undefined);
  return active;
}

export function readLocalAccountData<T>(reader: (data: LocalAccountData) => T | Promise<T>) {
  return serialize(async () => reader(await loadData()));
}

export function mutateLocalAccountData<T>(mutator: (data: LocalAccountData) => T | Promise<T>) {
  return serialize(async () => {
    const current = await loadData();
    const draft = structuredClone(current);
    const result = await mutator(draft);
    const validation = localAccountDataSchema.safeParse(draft);
    if (!validation.success) {
      throw new AppError("계정 데이터를 저장하지 못했습니다.", 500, "LOCAL_ACCOUNT_DATA_INVALID");
    }
    const validated = validation.data;
    const directory = dirname(filePath);
    const temporaryPath = resolve(directory, `.accounts-${process.pid}-${randomUUID()}.tmp`);
    await mkdir(directory, { recursive: true });
    try {
      await writeFile(temporaryPath, `${JSON.stringify(validated, null, 2)}\n`, {
        encoding: "utf8",
        mode: 0o600,
        flag: "wx",
      });
      await chmod(temporaryPath, 0o600).catch(() => undefined);
      await rename(temporaryPath, filePath);
      await chmod(filePath, 0o600).catch(() => undefined);
    } catch (error) {
      await unlink(temporaryPath).catch(() => undefined);
      throw error;
    }
    snapshot = validated;
    return result;
  });
}
