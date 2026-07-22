import { setTimeout as delay } from "node:timers/promises";
import { cleanText, parseKoreanCoordinates, uniqueText } from "./normalize.js";
import type { FacilityImportRecord } from "./types.js";

interface KakaoAddressDocument {
  x?: string;
  y?: string;
}

interface KakaoAddressResponse {
  documents?: KakaoAddressDocument[];
}

interface Coordinates {
  latitude: number;
  longitude: number;
}

function addressCandidates(address: string) {
  return uniqueText([
    address,
    address.replace(/\s*(?:앞|인근|주변|옆|맞은편)\s*$/g, ""),
    address.replace(/\([^)]*\)/g, "").replace(/\s*(?:앞|인근|주변|옆|맞은편)\s*$/g, ""),
  ], 3, 300);
}

async function requestAddress(query: string, apiKey: string) {
  const url = new URL("https://dapi.kakao.com/v2/local/search/address.json");
  url.searchParams.set("query", query);
  const response = await fetch(url, {
    headers: { Authorization: `KakaoAK ${apiKey}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Kakao 주소 검색 HTTP ${response.status}`);
  const payload = await response.json() as KakaoAddressResponse;
  const document = payload.documents?.[0];
  if (!document) return null;
  const coordinates = parseKoreanCoordinates(document.y, document.x);
  if (coordinates.latitude === null || coordinates.longitude === null) return null;
  return coordinates as Coordinates;
}

async function geocodeAddress(address: string, apiKey: string) {
  for (const query of addressCandidates(address)) {
    try {
      const coordinates = await requestAddress(query, apiKey);
      if (coordinates) return coordinates;
    } catch (error) {
      if (error instanceof Error && /HTTP 401|HTTP 403/.test(error.message)) throw error;
      await delay(150);
    }
  }
  return null;
}

export async function geocodeMissingFacilities(
  records: FacilityImportRecord[],
  apiKey: string,
) {
  const addresses = uniqueText(records
    .filter((record) => record.latitude === null || record.longitude === null)
    .map((record) => record.address), 100_000, 300);
  const coordinatesByAddress = new Map<string, Coordinates | null>();
  let cursor = 0;
  async function worker() {
    while (cursor < addresses.length) {
      const index = cursor;
      cursor += 1;
      const address = addresses[index];
      if (!address) continue;
      const coordinates = await geocodeAddress(address, apiKey);
      coordinatesByAddress.set(address, coordinates);
      await delay(60);
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, addresses.length) }, () => worker()));
  let resolved = 0;
  const geocoded = records.map((record) => {
    if (record.latitude !== null && record.longitude !== null) return record;
    const coordinates = coordinatesByAddress.get(cleanText(record.address, 300));
    if (!coordinates) return record;
    resolved += 1;
    return {
      ...record,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
    };
  });
  return {
    records: geocoded,
    attempted: addresses.length,
    resolved,
    unresolved: records.filter(
      (record) => record.latitude === null || record.longitude === null,
    ).length - resolved,
  };
}
