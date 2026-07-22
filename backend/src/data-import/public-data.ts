import {
  categoriesFromText,
  cleanText,
  firstText,
  joinDetails,
  nullableText,
  parseDate,
  parseKoreanCoordinates,
  sourceKey,
  splitItems,
} from "./normalize.js";
import type { FacilityImportRecord, SourceLoadResult } from "./types.js";

const publicDataBaseUrl = "https://apis.data.go.kr/B552584/wstElcCltInfo";
const publicDataSourceUrl = "https://www.data.go.kr/data/15156650/openapi.do";
const pageSize = 100;

type PublicDataItem = Record<string, unknown>;

interface PublicDataPage {
  items: PublicDataItem[];
  totalCount: number;
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function unwrapItems(value: unknown): PublicDataItem[] {
  if (Array.isArray(value)) return value.flatMap(unwrapItems);
  const object = asObject(value);
  if (!object) return [];
  if ("item" in object) return unwrapItems(object.item);
  return [object];
}

function parsePage(payload: unknown): PublicDataPage {
  const root = asObject(payload);
  const response = asObject(root?.response) ?? root;
  const header = asObject(response?.header);
  const body = asObject(response?.body);
  const resultCode = cleanText(header?.resultCode);
  if (resultCode && !["0", "00", "0000"].includes(resultCode)) {
    throw new Error(`공공데이터 API 오류 ${resultCode}: ${cleanText(header?.resultMsg) || "응답 오류"}`);
  }
  if (!body) throw new Error("공공데이터 API 응답에 body가 없습니다.");
  const totalCount = Number(cleanText(body.totalCount));
  return {
    items: unwrapItems(body.items),
    totalCount: Number.isFinite(totalCount) ? totalCount : 0,
  };
}

function encodedServiceKey(serviceKey: string) {
  return /%[0-9a-f]{2}/i.test(serviceKey) ? serviceKey : encodeURIComponent(serviceKey);
}

async function fetchPage(serviceKey: string, pageNo: number) {
  const url = `${publicDataBaseUrl}/getlist?serviceKey=${encodedServiceKey(serviceKey)}&pageNo=${pageNo}&numOfRows=${pageSize}&returnType=JSON`;
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) {
        const message = cleanText(await response.text(), 300);
        throw new Error(`공공데이터 API HTTP ${response.status}${message ? `: ${message}` : ""}`);
      }
      return parsePage(await response.json());
    } catch (error) {
      lastError = error;
      if (attempt === 3) break;
      await new Promise((resolve) => setTimeout(resolve, attempt * 400));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("공공데이터 API 요청에 실패했습니다.");
}

function makeOpeningHours(item: PublicDataItem) {
  const labels: Array<[string, unknown]> = [
    ["월", item.monSalsHr],
    ["화", item.tueSalsHr],
    ["수", item.wedSalsHr],
    ["목", item.thurSalsHr],
    ["금", item.friSalsHr],
    ["토", item.satSalsHr],
    ["일", item.sunSalsHr],
  ];
  const hours = labels
    .map(([label, value]) => {
      const text = cleanText(value, 30);
      return text ? `${label} ${text}` : "";
    })
    .filter(Boolean)
    .join(" · ");
  return hours ? hours.slice(0, 200) : null;
}

function isTemporarilyClosed(item: PublicDataItem) {
  const start = parseDate(item.tcbizBgngYmd);
  if (!start) return false;
  const end = parseDate(item.tcbizEndYmd);
  const now = new Date();
  return start <= now && (!end || end >= now);
}

function mapPublicDataItem(item: PublicDataItem): FacilityImportRecord | string {
  const name = cleanText(item.instlPstnNm, 200);
  const roadAddress = cleanText(item.roadNmAddr, 300);
  const lotAddress = cleanText(item.lotnoAddr, 300);
  const address = firstText([roadAddress, lotAddress, item.rgnNm], 300);
  if (!name) return "설치위치명이 없습니다.";
  if (!address) return "주소가 없습니다.";
  const detailLocation = joinDetails([
    nullableText(item.pathNm, 200),
    nullableText(item.dtlExpln, 500),
  ], 500);
  const coordinates = parseKoreanCoordinates(item.bldgLat, item.bldgLot);
  const acceptedText = firstText([item.hndlItemNm, "중소형 폐가전"], 1000);
  const suspended = isTemporarilyClosed(item);
  return {
    sourceKey: sourceKey([
      "public-small-electronics",
      name,
      roadAddress,
      lotAddress,
      detailLocation,
    ]),
    sourceDataset: "public-small-electronics",
    name,
    facilityType: firstText([item.comCdNm, "중소형 폐가전 수거함"], 100),
    address,
    detailLocation,
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    categoryIds: categoriesFromText(acceptedText, ["electronics", "recycle"]),
    acceptedItems: splitItems(acceptedText),
    openingHours: makeOpeningHours(item),
    status: suspended ? "unavailable" : "available",
    statusText: suspended ? "임시 휴업" : "공공데이터 등록 시설",
    verified: 1,
    managerName: nullableText(item.prcsBzentyNm, 200),
    managerPhone: nullableText(item.coTelno ?? item.rprsTelno, 50),
    sourceName: "한국환경공단",
    sourceUrl: publicDataSourceUrl,
    sourceUpdatedAt: parseDate(item.telgmRcptnYmd ?? item.crtYmd),
    note: joinDetails([
      nullableText(item.srvcExpln, 400),
      nullableText(item.etcExpln, 300),
      nullableText(item.etcCn, 300),
      nullableText(item.hldyExpln, 200),
      nullableText(item.telnoRmrkCn, 100),
      nullableText(item.siteUrlAddr, 300),
    ], 1000),
  };
}

export async function loadPublicDataFacilities(serviceKey: string) {
  const firstPage = await fetchPage(serviceKey, 1);
  const totalPages = Math.max(1, Math.ceil(firstPage.totalCount / pageSize));
  const items = [...firstPage.items];
  for (let pageNo = 2; pageNo <= totalPages; pageNo += 1) {
    const page = await fetchPage(serviceKey, pageNo);
    items.push(...page.items);
  }
  const result: SourceLoadResult = {
    sourceDataset: "public-small-electronics",
    sourceLabel: "한국환경공단 중소형 폐가전 수거함 OpenAPI",
    inputRows: items.length,
    records: [],
    rejected: [],
  };
  items.forEach((item, index) => {
    const mapped = mapPublicDataItem(item);
    if (typeof mapped === "string") {
      result.rejected.push({
        rowNumber: index + 1,
        name: nullableText(item.instlPstnNm, 200),
        reason: mapped,
      });
      return;
    }
    result.records.push(mapped);
  });
  return result;
}
