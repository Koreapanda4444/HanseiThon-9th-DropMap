import { withConnection } from "../database/oracle.js";
import { classifyLocalWaste, findLocalWasteItems } from "../data-import/local-store.js";
import { facilityCategoryIds, type ClassificationResult, type FacilityCategoryId, type WasteItem } from "../domain.js";
import { runWithDataSource } from "../services/data-source.js";

interface WasteItemRow {
  id: string;
  name: string;
  aliases: string | null;
  categoryId: string;
  disposalTip: string;
  confidence?: number;
}

function toCategoryId(value: string) {
  return facilityCategoryIds.includes(value as FacilityCategoryId)
    ? value as FacilityCategoryId
    : null;
}

function toWasteItem(row: WasteItemRow): WasteItem | null {
  const categoryId = toCategoryId(row.categoryId);
  if (!categoryId) return null;
  return {
    id: row.id,
    name: row.name,
    aliases: row.aliases?.split("|").filter(Boolean) ?? [],
    categoryId,
    disposalTip: row.disposalTip,
  };
}

const wasteItemSelect = `
  SELECT
    wi.id "id",
    wi.name "name",
    (
      SELECT LISTAGG(wia.alias, '|') WITHIN GROUP (ORDER BY wia.alias)
      FROM waste_item_aliases wia
      WHERE wia.waste_item_id = wi.id
    ) "aliases",
    wi.category_id "categoryId",
    wi.disposal_tip "disposalTip"`;

async function findOracleWasteItems(query?: string, limit = 100) {
  const where = query
    ? `AND (
      INSTR(LOWER(wi.name), LOWER(:query)) > 0
      OR EXISTS (
        SELECT 1 FROM waste_item_aliases searched_alias
        WHERE searched_alias.waste_item_id = wi.id
          AND INSTR(LOWER(searched_alias.alias), LOWER(:query)) > 0
      )
    )`
    : "";
  const result = await withConnection((connection) => connection.execute(
    `${wasteItemSelect}
      FROM waste_items wi
      WHERE wi.active = 1
      ${where}
      ORDER BY wi.name
      FETCH FIRST ${limit} ROWS ONLY`,
    query ? { query } : {},
  ));
  return ((result.rows ?? []) as WasteItemRow[])
    .map(toWasteItem)
    .filter((item): item is WasteItem => item !== null);
}

async function classifyOracleWaste(query: string) {
  const result = await withConnection((connection) => connection.execute(
    `SELECT * FROM (
      ${wasteItemSelect},
      CASE
        WHEN LOWER(wi.name) = LOWER(:query) THEN 0.99
        WHEN INSTR(LOWER(:query), LOWER(wi.name)) > 0 THEN 0.96
        WHEN EXISTS (
          SELECT 1 FROM waste_item_aliases exact_alias
          WHERE exact_alias.waste_item_id = wi.id
            AND LOWER(exact_alias.alias) = LOWER(:query)
        ) THEN 0.94
        ELSE 0.82
      END "confidence"
      FROM waste_items wi
      WHERE wi.active = 1
        AND (
          INSTR(LOWER(:query), LOWER(wi.name)) > 0
          OR INSTR(LOWER(wi.name), LOWER(:query)) > 0
          OR EXISTS (
            SELECT 1 FROM waste_item_aliases matched_alias
            WHERE matched_alias.waste_item_id = wi.id
              AND (
                INSTR(LOWER(:query), LOWER(matched_alias.alias)) > 0
                OR INSTR(LOWER(matched_alias.alias), LOWER(:query)) > 0
              )
          )
        )
      ORDER BY "confidence" DESC, wi.name
    ) WHERE ROWNUM <= 3`,
    { query },
  ));

  return ((result.rows ?? []) as WasteItemRow[]).flatMap((row): ClassificationResult[] => {
    const item = toWasteItem(row);
    if (!item) return [];
    return [{
      id: item.id,
      displayName: item.name,
      categoryId: item.categoryId,
      confidence: Number(row.confidence ?? 0),
      disposalTip: item.disposalTip,
    }];
  });
}

export function findWasteItems(query?: string, limit = 100) {
  return runWithDataSource(
    () => findOracleWasteItems(query, limit),
    () => findLocalWasteItems(query, limit),
  );
}

export function classifyWaste(query: string) {
  return runWithDataSource(
    () => classifyOracleWaste(query),
    () => classifyLocalWaste(query),
  );
}
