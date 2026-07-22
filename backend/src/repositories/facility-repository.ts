import type { BindParameters, Connection } from "oracledb";
import { withConnection } from "../database/oracle.js";
import { facilityCategoryIds, type Facility, type FacilityCategoryId, type FacilityStatus } from "../domain.js";

interface FacilityRow {
  id: number | string;
  name: string;
  type: string;
  address: string;
  detailLocation: string | null;
  latitude: number;
  longitude: number;
  categoryIds: string | null;
  acceptedItems: string | null;
  openingHours: string | null;
  status: FacilityStatus;
  statusText: string | null;
  updatedAt: Date | string | null;
  verified: number;
  source: string | null;
  note: string | null;
  distanceM: number | null;
}

export interface FacilityFilters {
  categoryId?: FacilityCategoryId | undefined;
  query?: string | undefined;
  ids?: string[] | undefined;
  latitude?: number | undefined;
  longitude?: number | undefined;
  radiusM?: number | undefined;
  west?: number | undefined;
  south?: number | undefined;
  east?: number | undefined;
  north?: number | undefined;
  limit: number;
}

const statusLabels: Record<FacilityStatus, string> = {
  available: "이용 가능",
  busy: "확인 필요",
  unavailable: "이용 불가",
};

const baseSelect = `
  SELECT
    f.id "id",
    f.name "name",
    f.facility_type "type",
    f.address "address",
    f.detail_location "detailLocation",
    f.latitude "latitude",
    f.longitude "longitude",
    (
      SELECT LISTAGG(fc.category_id, '|') WITHIN GROUP (ORDER BY fc.category_id)
      FROM facility_categories fc
      WHERE fc.facility_id = f.id
    ) "categoryIds",
    (
      SELECT LISTAGG(fai.item_name, '|') WITHIN GROUP (ORDER BY fai.sort_order, fai.item_name)
      FROM facility_accepted_items fai
      WHERE fai.facility_id = f.id
    ) "acceptedItems",
    f.opening_hours "openingHours",
    f.status "status",
    f.status_text "statusText",
    COALESCE(f.source_updated_at, f.updated_at) "updatedAt",
    f.verified "verified",
    f.source_name "source",
    f.note "note"`;

function toIsoString(value: Date | string | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toFacility(row: FacilityRow): Facility {
  const categoryIds = (row.categoryIds?.split("|") ?? []).filter(
    (value): value is FacilityCategoryId => facilityCategoryIds.includes(value as FacilityCategoryId),
  );
  const distanceM = row.distanceM === null ? null : Number(row.distanceM);
  return {
    id: String(row.id),
    name: row.name,
    type: row.type,
    address: row.address,
    detailLocation: row.detailLocation,
    distanceM,
    walkMinutes: distanceM === null ? null : Math.max(1, Math.ceil(distanceM / 80)),
    coordinates: {
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
    },
    categoryIds,
    acceptedItems: row.acceptedItems?.split("|").filter(Boolean) ?? [],
    openingHours: row.openingHours,
    status: row.status,
    statusText: row.statusText || statusLabels[row.status],
    updatedAt: toIsoString(row.updatedAt),
    verified: Boolean(row.verified),
    source: row.source,
    note: row.note,
  };
}

async function executeFacilities(
  connection: Connection,
  sql: string,
  binds: BindParameters,
) {
  const result = await connection.execute(sql, binds);
  return ((result.rows ?? []) as FacilityRow[]).map(toFacility);
}

export async function findFacilities(filters: FacilityFilters) {
  const conditions: string[] = [];
  const binds: Record<string, string | number | undefined> = {};
  const hasLocation = filters.latitude !== undefined && filters.longitude !== undefined;
  const distanceSelect = hasLocation
    ? `,
    ROUND(MDSYS.SDO_GEOM.SDO_DISTANCE(
      f.location,
      MDSYS.SDO_GEOMETRY(2001, 4326, MDSYS.SDO_POINT_TYPE(:longitude, :latitude, NULL), NULL, NULL),
      0.005,
      'unit=M'
    )) "distanceM"`
    : `, CAST(NULL AS NUMBER) "distanceM"`;

  if (filters.categoryId) {
    conditions.push(`EXISTS (
      SELECT 1 FROM facility_categories selected_category
      WHERE selected_category.facility_id = f.id
        AND selected_category.category_id = :categoryId
    )`);
    binds.categoryId = filters.categoryId;
  }

  if (filters.query) {
    conditions.push(`(
      INSTR(LOWER(f.name), LOWER(:query)) > 0
      OR INSTR(LOWER(f.address), LOWER(:query)) > 0
      OR INSTR(LOWER(f.facility_type), LOWER(:query)) > 0
      OR EXISTS (
        SELECT 1 FROM facility_accepted_items searched_item
        WHERE searched_item.facility_id = f.id
          AND INSTR(LOWER(searched_item.item_name), LOWER(:query)) > 0
      )
    )`);
    binds.query = filters.query;
  }

  if (filters.ids?.length) {
    const idBinds = filters.ids.map((id, index) => {
      const key = `facilityId${index}`;
      binds[key] = Number(id);
      return `:${key}`;
    });
    conditions.push(`f.id IN (${idBinds.join(", ")})`);
  }

  if (
    filters.west !== undefined
    && filters.south !== undefined
    && filters.east !== undefined
    && filters.north !== undefined
  ) {
    conditions.push("f.longitude BETWEEN :west AND :east");
    conditions.push("f.latitude BETWEEN :south AND :north");
    binds.west = filters.west;
    binds.south = filters.south;
    binds.east = filters.east;
    binds.north = filters.north;
  }

  if (hasLocation) {
    binds.latitude = filters.latitude;
    binds.longitude = filters.longitude;
    if (filters.radiusM !== undefined) {
      conditions.push(`MDSYS.SDO_GEOM.SDO_DISTANCE(
        f.location,
        MDSYS.SDO_GEOMETRY(2001, 4326, MDSYS.SDO_POINT_TYPE(:longitude, :latitude, NULL), NULL, NULL),
        0.005,
        'unit=M'
      ) <= :radiusM`);
      binds.radiusM = filters.radiusM;
    }
  }

  const where = conditions.length ? `WHERE ${conditions.join("\nAND ")}` : "";
  const order = hasLocation ? `ORDER BY "distanceM" NULLS LAST, f.name` : "ORDER BY f.updated_at DESC, f.name";
  const sql = `${baseSelect}${distanceSelect}
    FROM facilities f
    ${where}
    ${order}
    FETCH FIRST ${filters.limit} ROWS ONLY`;

  return withConnection((connection) => executeFacilities(connection, sql, binds));
}

export async function findFacilityById(id: number) {
  const sql = `${baseSelect}, CAST(NULL AS NUMBER) "distanceM"
    FROM facilities f
    WHERE f.id = :id`;
  const facilities = await withConnection((connection) => executeFacilities(connection, sql, { id }));
  return facilities[0] ?? null;
}

export async function getFacilityStats() {
  return withConnection(async (connection) => {
    const result = await connection.execute(`
      SELECT
        (SELECT COUNT(*) FROM facilities) "facilities",
        (SELECT COUNT(DISTINCT source_name) FROM facilities WHERE source_name IS NOT NULL) "sources"
      FROM DUAL
    `);
    const row = (result.rows?.[0] ?? { facilities: 0, sources: 0 }) as {
      facilities: number;
      sources: number;
    };
    return { facilities: Number(row.facilities), sources: Number(row.sources) };
  });
}
