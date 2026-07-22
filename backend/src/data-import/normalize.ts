import { createHash } from "node:crypto";
import type { FacilityCategoryId } from "../domain.js";
import type { FacilityImportRecord, PreparedImport } from "./types.js";

export function cleanText(value: unknown, maximum = Number.MAX_SAFE_INTEGER) {
  const text = String(value ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, maximum);
}

export function nullableText(value: unknown, maximum: number) {
  const text = cleanText(value, maximum);
  return text || null;
}

export function firstText(values: unknown[], maximum: number) {
  for (const value of values) {
    const text = cleanText(value, maximum);
    if (text) return text;
  }
  return "";
}

export function uniqueText(values: string[], maximumItems = 30, maximumLength = 120) {
  return [...new Set(values.map((value) => cleanText(value, maximumLength)).filter(Boolean))]
    .slice(0, maximumItems);
}

export function splitItems(value: unknown) {
  const text = cleanText(value, 1000).replace(/\s+등$/, "");
  if (!text) return [];
  return uniqueText(text.split(/\s*(?:\+|,|\/|·|;|\|)\s*/g), 30, 120);
}

export function joinDetails(parts: Array<string | null | undefined>, maximum: number) {
  const text = uniqueText(parts.filter((part): part is string => Boolean(part)), 30, maximum)
    .join(" · ");
  return text ? text.slice(0, maximum) : null;
}

export function sourceKey(parts: unknown[]) {
  const seed = parts.map((part) => cleanText(part).toLocaleLowerCase("ko-KR")).join("|");
  return createHash("sha256").update(seed).digest("hex");
}

export function parseDate(value: unknown) {
  const text = cleanText(value);
  if (!text) return null;
  const compact = text.replace(/[^0-9]/g, "");
  if (compact.length >= 8) {
    const year = Number(compact.slice(0, 4));
    const month = Number(compact.slice(4, 6));
    const day = Number(compact.slice(6, 8));
    if (year >= 2000 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const date = new Date(Date.UTC(year, month - 1, day));
      if (date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day) {
        return date;
      }
    }
  }
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseCoordinate(value: unknown, minimum: number, maximum: number) {
  const text = cleanText(value).replace(",", ".");
  if (!text) return null;
  const coordinate = Number(text);
  if (!Number.isFinite(coordinate) || coordinate < minimum || coordinate > maximum) return null;
  return coordinate;
}

export function parseKoreanCoordinates(latitude: unknown, longitude: unknown) {
  const parsedLatitude = parseCoordinate(latitude, 33, 39.5);
  const parsedLongitude = parseCoordinate(longitude, 124, 132);
  if (parsedLatitude === null || parsedLongitude === null) {
    return { latitude: null, longitude: null };
  }
  return { latitude: parsedLatitude, longitude: parsedLongitude };
}

export function categoriesFromText(text: string, base: FacilityCategoryId[]) {
  const categories = [...base];
  if (/일반쓰레기|종량제/.test(text)) categories.push("general");
  if (/재활용/.test(text)) categories.push("recycle");
  if (/의류|헌옷/.test(text)) categories.push("clothes");
  if (/건전지|배터리|전지|형광|LED/.test(text)) categories.push("battery");
  if (/담배|꽁초/.test(text)) categories.push("cigarette");
  return [...new Set(categories)];
}

function mergeRecord(current: FacilityImportRecord, incoming: FacilityImportRecord) {
  const newest = !current.sourceUpdatedAt
    || (incoming.sourceUpdatedAt && incoming.sourceUpdatedAt > current.sourceUpdatedAt)
    ? incoming
    : current;
  return {
    ...newest,
    latitude: newest.latitude ?? current.latitude ?? incoming.latitude,
    longitude: newest.longitude ?? current.longitude ?? incoming.longitude,
    categoryIds: [...new Set([...current.categoryIds, ...incoming.categoryIds])],
    acceptedItems: uniqueText([...current.acceptedItems, ...incoming.acceptedItems]),
    note: joinDetails([current.note, incoming.note], 1000),
  } satisfies FacilityImportRecord;
}

export function prepareImport(records: FacilityImportRecord[]): PreparedImport {
  const merged = new Map<string, FacilityImportRecord>();
  let duplicateRows = 0;
  for (const record of records) {
    const current = merged.get(record.sourceKey);
    if (current) {
      duplicateRows += 1;
      merged.set(record.sourceKey, mergeRecord(current, record));
    } else {
      merged.set(record.sourceKey, record);
    }
  }
  const uniqueRecords = [...merged.values()];
  const ready = uniqueRecords.filter(
    (record) => record.latitude !== null && record.longitude !== null,
  );
  return {
    records: ready,
    duplicateRows,
    missingCoordinates: uniqueRecords.length - ready.length,
  };
}
