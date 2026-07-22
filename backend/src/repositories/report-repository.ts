import oracledb from "oracledb";
import { withConnection } from "../database/oracle.js";
import type { ReportStatus, ReportType, UserReport } from "../domain.js";

interface ReportRow {
  id: number | string;
  facilityId: number | string;
  facilityName: string;
  type: ReportType;
  content: string;
  createdAt: Date | string;
  status: ReportStatus;
}

function toReport(row: ReportRow): UserReport {
  const createdAt = row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt);
  return {
    id: String(row.id),
    facilityId: String(row.facilityId),
    facilityName: row.facilityName,
    type: row.type,
    content: row.content,
    createdAt: createdAt.toISOString(),
    status: row.status,
  };
}

const reportSelect = `
  SELECT
    ur.id "id",
    ur.facility_id "facilityId",
    f.name "facilityName",
    ur.report_type "type",
    ur.content "content",
    ur.created_at "createdAt",
    ur.status "status"
  FROM user_reports ur
  JOIN facilities f ON f.id = ur.facility_id`;

export async function createReport(input: {
  facilityId: number;
  deviceId: string;
  type: ReportType;
  content: string;
}) {
  return withConnection(async (connection) => {
    const result = await connection.execute(
      `INSERT INTO user_reports (facility_id, device_id, report_type, content)
       VALUES (:facilityId, :deviceId, :type, :content)
       RETURNING id INTO :id`,
      {
        ...input,
        id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      },
      { autoCommit: true },
    );
    const outBinds = result.outBinds as { id: number | number[] };
    const id = Array.isArray(outBinds.id) ? outBinds.id[0] : outBinds.id;
    const created = await connection.execute(
      `${reportSelect} WHERE ur.id = :id`,
      { id },
    );
    const row = created.rows?.[0] as ReportRow | undefined;
    if (!row) throw new Error("Created report could not be loaded");
    return toReport(row);
  });
}

export async function findReportsByDevice(deviceId: string, limit = 50) {
  const result = await withConnection((connection) => connection.execute(
    `${reportSelect}
     WHERE ur.device_id = :deviceId
     ORDER BY ur.created_at DESC
     FETCH FIRST ${limit} ROWS ONLY`,
    { deviceId },
  ));
  return ((result.rows ?? []) as ReportRow[]).map(toReport);
}
