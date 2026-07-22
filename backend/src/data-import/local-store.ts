import type {
  ClassificationResult,
  Facility,
  WasteItem,
} from "../domain.js";
import type { FacilityFilters } from "../repositories/facility-repository.js";
import { env } from "../config/env.js";
import { loadCsvFacilities, resolveCsvDirectory } from "./csv-sources.js";
import { prepareImport } from "./normalize.js";
import { loadPublicDataFacilities } from "./public-data.js";
import { wasteCatalog } from "./waste-catalog.js";

interface LocalSnapshot {
  facilities: Facility[];
  facilitiesById: Map<string, Facility>;
  sources: number;
}

let snapshot: LocalSnapshot | null = null;
let initialization: Promise<LocalSnapshot> | null = null;

function toRadians(value: number) {
  return value * Math.PI / 180;
}

function distanceBetween(
  first: { latitude: number; longitude: number },
  second: { latitude: number; longitude: number },
) {
  const earthRadiusM = 6_371_000;
  const latitudeDelta = toRadians(second.latitude - first.latitude);
  const longitudeDelta = toRadians(second.longitude - first.longitude);
  const firstLatitude = toRadians(first.latitude);
  const secondLatitude = toRadians(second.latitude);
  const value = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return Math.round(earthRadiusM * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value)));
}

function normalizedText(value: string) {
  return value.toLocaleLowerCase("ko-KR").replace(/\s+/g, "").trim();
}

function isInsideLongitude(longitude: number, west: number, east: number) {
  return west <= east
    ? longitude >= west && longitude <= east
    : longitude >= west || longitude <= east;
}

async function buildSnapshot() {
  const directory = await resolveCsvDirectory();
  const sources = await loadCsvFacilities(directory);
  if (env.PUBLIC_DATA_SERVICE_KEY) {
    try {
      sources.push(await loadPublicDataFacilities(env.PUBLIC_DATA_SERVICE_KEY));
    } catch (error) {
      console.error("Public data synchronization failed", error);
    }
  }
  const prepared = prepareImport(sources.flatMap((source) => source.records));
  const facilities = prepared.records.map((record, index): Facility => ({
    id: String(index + 1),
    name: record.name,
    type: record.facilityType,
    address: record.address,
    detailLocation: record.detailLocation,
    distanceM: null,
    walkMinutes: null,
    coordinates: {
      latitude: record.latitude as number,
      longitude: record.longitude as number,
    },
    categoryIds: record.categoryIds,
    acceptedItems: record.acceptedItems,
    openingHours: record.openingHours,
    status: record.status,
    statusText: record.statusText,
    updatedAt: record.sourceUpdatedAt?.toISOString() ?? null,
    verified: Boolean(record.verified),
    source: record.sourceName,
    note: record.note,
  }));
  return {
    facilities,
    facilitiesById: new Map(facilities.map((facility) => [facility.id, facility])),
    sources: new Set(prepared.records.map((record) => record.sourceName).filter(Boolean)).size,
  } satisfies LocalSnapshot;
}

export async function initializeLocalStore() {
  if (snapshot) return snapshot;
  initialization ??= buildSnapshot();
  try {
    snapshot = await initialization;
    return snapshot;
  } catch (error) {
    initialization = null;
    throw error;
  }
}

export async function findLocalFacilities(filters: FacilityFilters) {
  const store = await initializeLocalStore();
  const ids = filters.ids?.length ? new Set(filters.ids) : null;
  const query = filters.query ? normalizedText(filters.query) : "";
  const hasLocation = filters.latitude !== undefined && filters.longitude !== undefined;
  const location = hasLocation
    ? { latitude: filters.latitude as number, longitude: filters.longitude as number }
    : null;
  const hasBounds = filters.west !== undefined
    && filters.south !== undefined
    && filters.east !== undefined
    && filters.north !== undefined;

  const facilities = store.facilities
    .filter((facility) => !filters.categoryId || facility.categoryIds.includes(filters.categoryId))
    .filter((facility) => !ids || ids.has(facility.id))
    .filter((facility) => {
      if (!query) return true;
      return normalizedText([
        facility.name,
        facility.type,
        facility.address,
        facility.detailLocation ?? "",
        ...facility.acceptedItems,
      ].join(" ")).includes(query);
    })
    .filter((facility) => {
      if (!hasBounds) return true;
      return facility.coordinates.latitude >= (filters.south as number)
        && facility.coordinates.latitude <= (filters.north as number)
        && isInsideLongitude(
          facility.coordinates.longitude,
          filters.west as number,
          filters.east as number,
        );
    })
    .map((facility) => {
      const distanceM = location ? distanceBetween(location, facility.coordinates) : null;
      return {
        ...facility,
        distanceM,
        walkMinutes: distanceM === null ? null : Math.max(1, Math.ceil(distanceM / 80)),
      };
    })
    .filter((facility) => filters.radiusM === undefined
      || facility.distanceM === null
      || facility.distanceM <= filters.radiusM)
    .sort((first, second) => {
      if (location) {
        return (first.distanceM ?? Number.POSITIVE_INFINITY)
          - (second.distanceM ?? Number.POSITIVE_INFINITY)
          || first.name.localeCompare(second.name, "ko-KR");
      }
      const firstUpdated = first.updatedAt ? Date.parse(first.updatedAt) : 0;
      const secondUpdated = second.updatedAt ? Date.parse(second.updatedAt) : 0;
      return secondUpdated - firstUpdated || first.name.localeCompare(second.name, "ko-KR");
    });
  return filters.limit === undefined ? facilities : facilities.slice(0, filters.limit);
}

export async function findLocalFacilityById(id: number) {
  const store = await initializeLocalStore();
  return store.facilitiesById.get(String(id)) ?? null;
}

export async function getLocalFacilityStats() {
  const store = await initializeLocalStore();
  return { facilities: store.facilities.length, sources: store.sources };
}

export async function findLocalWasteItems(query?: string, limit = 100) {
  await initializeLocalStore();
  const normalized = query ? normalizedText(query) : "";
  return wasteCatalog
    .filter((item) => !normalized || [item.name, ...item.aliases]
      .some((value) => normalizedText(value).includes(normalized)))
    .slice(0, limit);
}

function matchScore(item: WasteItem, query: string) {
  const name = normalizedText(item.name);
  const aliases = item.aliases.map(normalizedText);
  if (name === query) return 0.99;
  if (aliases.includes(query)) return 0.96;
  if (query.includes(name)) return 0.93;
  if (aliases.some((alias) => query.includes(alias))) return 0.91;
  if (name.includes(query)) return 0.86;
  if (aliases.some((alias) => alias.includes(query))) return 0.84;
  return 0;
}

export async function classifyLocalWaste(query: string) {
  await initializeLocalStore();
  const normalized = normalizedText(query);
  return wasteCatalog
    .map((item) => ({ item, confidence: matchScore(item, normalized) }))
    .filter(({ confidence }) => confidence > 0)
    .sort((first, second) => second.confidence - first.confidence
      || first.item.name.localeCompare(second.item.name, "ko-KR"))
    .slice(0, 3)
    .map(({ item, confidence }): ClassificationResult => ({
      id: item.id,
      displayName: item.name,
      categoryId: item.categoryId,
      confidence,
      disposalTip: item.disposalTip,
    }));
}
