import { mutateLocalAccountData, readLocalAccountData } from "../data-import/local-account-store.js";
import { withConnection } from "../database/oracle.js";
import type { UserReport } from "../domain.js";
import { runWithDataSource } from "../services/data-source.js";

interface ReportRow {
  id: string;
  userId: string;
  facilityId: number | string;
  reportType: UserReport["reportType"];
  content: string;
  status: UserReport["status"];
  createdAt: Date | string;
  updatedAt: Date | string;
}

function toReport(row: ReportRow): UserReport {
  return {
    id: String(row.id),
    userId: row.userId,
    facilityId: String(row.facilityId),
    reportType: row.reportType,
    content: row.content,
    status: row.status,
    createdAt: (row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt)).toISOString(),
    updatedAt: (row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt)).toISOString(),
  };
}

async function createOracleReport(report: UserReport) {
  await withConnection(async (connection) => {
    await connection.execute(`
      INSERT INTO user_reports (
        id, facility_id, user_id, report_type, content, status, created_at, updated_at
      ) VALUES (
        :id, :facilityId, :userId, :reportType, :content, :status, :createdAt, :updatedAt
      )
    `, {
      ...report,
      facilityId: Number(report.facilityId),
      createdAt: new Date(report.createdAt),
      updatedAt: new Date(report.updatedAt),
    });
    await connection.commit();
  });
  return report;
}

async function listOracleReports(userId: string) {
  return withConnection(async (connection) => {
    const result = await connection.execute<ReportRow>(`
      SELECT
        id "id",
        user_id "userId",
        facility_id "facilityId",
        report_type "reportType",
        content "content",
        status "status",
        created_at "createdAt",
        updated_at "updatedAt"
      FROM user_reports
      WHERE user_id = :userId
      ORDER BY created_at DESC
      FETCH FIRST 200 ROWS ONLY
    `, { userId });
    return (result.rows ?? []).map(toReport);
  });
}

function createLocalReport(report: UserReport) {
  return mutateLocalAccountData((data) => {
    data.reports.push({ ...report });
    return report;
  });
}

function listLocalReports(userId: string) {
  return readLocalAccountData((data) => data.reports
    .filter((report) => report.userId === userId)
    .sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt))
    .slice(0, 200)
    .map((report) => ({ ...report })));
}

export function createReport(report: UserReport) {
  return runWithDataSource(
    () => createOracleReport(report),
    () => createLocalReport(report),
  );
}

export function listReports(userId: string) {
  return runWithDataSource(
    () => listOracleReports(userId),
    () => listLocalReports(userId),
  );
}
