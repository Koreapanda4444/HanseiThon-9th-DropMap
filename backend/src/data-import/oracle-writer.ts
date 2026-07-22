import oracledb, { type Connection } from "oracledb";
import { withConnection } from "../database/oracle.js";
import type { FacilityImportRecord } from "./types.js";

const batchSize = 500;

interface FacilityIdRow {
  id: number | string;
  sourceKey: string;
}

function chunks<T>(values: T[], size = batchSize) {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

const mergeSql = `
  MERGE INTO facilities target
  USING (SELECT :sourceKey source_key FROM DUAL) incoming
  ON (target.source_key = incoming.source_key)
  WHEN MATCHED THEN UPDATE SET
    target.source_dataset = :sourceDataset,
    target.name = :name,
    target.facility_type = :facilityType,
    target.address = :address,
    target.detail_location = :detailLocation,
    target.latitude = :latitude,
    target.longitude = :longitude,
    target.opening_hours = :openingHours,
    target.status = :status,
    target.status_text = :statusText,
    target.verified = :verified,
    target.manager_name = :managerName,
    target.manager_phone = :managerPhone,
    target.source_name = :sourceName,
    target.source_url = :sourceUrl,
    target.source_updated_at = :sourceUpdatedAt,
    target.note = :note
  WHEN NOT MATCHED THEN INSERT (
    source_key,
    source_dataset,
    name,
    facility_type,
    address,
    detail_location,
    latitude,
    longitude,
    opening_hours,
    status,
    status_text,
    verified,
    manager_name,
    manager_phone,
    source_name,
    source_url,
    source_updated_at,
    note
  ) VALUES (
    :sourceKey,
    :sourceDataset,
    :name,
    :facilityType,
    :address,
    :detailLocation,
    :latitude,
    :longitude,
    :openingHours,
    :status,
    :statusText,
    :verified,
    :managerName,
    :managerPhone,
    :sourceName,
    :sourceUrl,
    :sourceUpdatedAt,
    :note
  )`;

const facilityBindDefinitions = {
  sourceKey: { type: oracledb.STRING, maxSize: 64 },
  sourceDataset: { type: oracledb.STRING, maxSize: 320 },
  name: { type: oracledb.STRING, maxSize: 800 },
  facilityType: { type: oracledb.STRING, maxSize: 400 },
  address: { type: oracledb.STRING, maxSize: 1200 },
  detailLocation: { type: oracledb.STRING, maxSize: 2000 },
  latitude: { type: oracledb.NUMBER },
  longitude: { type: oracledb.NUMBER },
  openingHours: { type: oracledb.STRING, maxSize: 800 },
  status: { type: oracledb.STRING, maxSize: 80 },
  statusText: { type: oracledb.STRING, maxSize: 400 },
  verified: { type: oracledb.NUMBER },
  managerName: { type: oracledb.STRING, maxSize: 800 },
  managerPhone: { type: oracledb.STRING, maxSize: 200 },
  sourceName: { type: oracledb.STRING, maxSize: 800 },
  sourceUrl: { type: oracledb.STRING, maxSize: 2000 },
  sourceUpdatedAt: { type: oracledb.DATE },
  note: { type: oracledb.STRING, maxSize: 4000 },
};

function facilityBinds(record: FacilityImportRecord) {
  if (record.latitude === null || record.longitude === null) {
    throw new Error(`${record.name}의 좌표가 없습니다.`);
  }
  return {
    sourceKey: record.sourceKey,
    sourceDataset: record.sourceDataset,
    name: record.name,
    facilityType: record.facilityType,
    address: record.address,
    detailLocation: record.detailLocation,
    latitude: record.latitude,
    longitude: record.longitude,
    openingHours: record.openingHours,
    status: record.status,
    statusText: record.statusText,
    verified: record.verified,
    managerName: record.managerName,
    managerPhone: record.managerPhone,
    sourceName: record.sourceName,
    sourceUrl: record.sourceUrl,
    sourceUpdatedAt: record.sourceUpdatedAt,
    note: record.note,
  };
}

async function upsertFacilities(connection: Connection, records: FacilityImportRecord[]) {
  let rowsAffected = 0;
  for (const batch of chunks(records)) {
    const result = await connection.executeMany(mergeSql, batch.map(facilityBinds), {
      bindDefs: facilityBindDefinitions,
    });
    rowsAffected += result.rowsAffected ?? 0;
  }
  return rowsAffected;
}

async function findFacilityIds(connection: Connection, records: FacilityImportRecord[]) {
  const ids = new Map<string, number>();
  for (const batch of chunks(records)) {
    const binds: Record<string, string> = {};
    const placeholders = batch.map((record, index) => {
      const key = `sourceKey${index}`;
      binds[key] = record.sourceKey;
      return `:${key}`;
    });
    const result = await connection.execute(
      `SELECT id "id", source_key "sourceKey" FROM facilities WHERE source_key IN (${placeholders.join(", ")})`,
      binds,
    );
    for (const row of (result.rows ?? []) as FacilityIdRow[]) {
      ids.set(row.sourceKey, Number(row.id));
    }
  }
  if (ids.size !== records.length) {
    throw new Error(`시설 ID 확인 실패: 요청 ${records.length}개, 조회 ${ids.size}개`);
  }
  return ids;
}

async function replaceFacilityDetails(
  connection: Connection,
  records: FacilityImportRecord[],
  ids: Map<string, number>,
) {
  const facilityIds = records.map((record) => ({ facilityId: ids.get(record.sourceKey) as number }));
  for (const batch of chunks(facilityIds)) {
    await connection.executeMany(
      "DELETE FROM facility_categories WHERE facility_id = :facilityId",
      batch,
      { bindDefs: { facilityId: { type: oracledb.NUMBER } } },
    );
    await connection.executeMany(
      "DELETE FROM facility_accepted_items WHERE facility_id = :facilityId",
      batch,
      { bindDefs: { facilityId: { type: oracledb.NUMBER } } },
    );
  }
  const categories = records.flatMap((record) => {
    const facilityId = ids.get(record.sourceKey) as number;
    return record.categoryIds.map((categoryId) => ({ facilityId, categoryId }));
  });
  const acceptedItems = records.flatMap((record) => {
    const facilityId = ids.get(record.sourceKey) as number;
    return record.acceptedItems.map((itemName, sortOrder) => ({ facilityId, itemName, sortOrder }));
  });
  for (const batch of chunks(categories)) {
    await connection.executeMany(
      "INSERT INTO facility_categories (facility_id, category_id) VALUES (:facilityId, :categoryId)",
      batch,
      {
        bindDefs: {
          facilityId: { type: oracledb.NUMBER },
          categoryId: { type: oracledb.STRING, maxSize: 80 },
        },
      },
    );
  }
  for (const batch of chunks(acceptedItems)) {
    await connection.executeMany(
      "INSERT INTO facility_accepted_items (facility_id, item_name, sort_order) VALUES (:facilityId, :itemName, :sortOrder)",
      batch,
      {
        bindDefs: {
          facilityId: { type: oracledb.NUMBER },
          itemName: { type: oracledb.STRING, maxSize: 480 },
          sortOrder: { type: oracledb.NUMBER },
        },
      },
    );
  }
  return { categories: categories.length, acceptedItems: acceptedItems.length };
}

export function writeFacilities(records: FacilityImportRecord[]) {
  return withConnection(async (connection) => {
    try {
      const upserted = await upsertFacilities(connection, records);
      const ids = await findFacilityIds(connection, records);
      const details = await replaceFacilityDetails(connection, records, ids);
      await connection.commit();
      return { upserted, ...details };
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  });
}
