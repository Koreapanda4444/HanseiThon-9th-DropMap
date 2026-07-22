import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { env } from "../config/env.js";
import type { ReportStatus, ReportType } from "../domain.js";

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
let snapshot: LocalAccountData | null = null;
let queue: Promise<unknown> = Promise.resolve();

function emptyData(): LocalAccountData {
  return { accounts: [], sessions: [], reports: [] };
}

async function loadData() {
  if (snapshot) return snapshot;
  try {
    const parsed = JSON.parse(await readFile(filePath, "utf8")) as Partial<LocalAccountData>;
    snapshot = {
      accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      reports: Array.isArray(parsed.reports) ? parsed.reports : [],
    };
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
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, `${JSON.stringify(draft, null, 2)}\n`, "utf8");
    snapshot = draft;
    return result;
  });
}
