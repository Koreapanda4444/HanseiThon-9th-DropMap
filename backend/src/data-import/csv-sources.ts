import { access, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { parse } from "csv-parse/sync";
import type { FacilityCategoryId, FacilityStatus } from "../domain.js";
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
  uniqueText,
} from "./normalize.js";
import type { FacilityImportRecord, SourceLoadResult } from "./types.js";

type CsvRow = Record<string, string>;

interface CsvSourceDefinition {
  sourceDataset: string;
  sourceLabel: string;
  fileName: string;
  requiredHeaders: string[];
  map: (row: CsvRow) => FacilityImportRecord | string;
}

interface BaseRecordInput {
  row: CsvRow;
  sourceDataset: string;
  sourceLabel: string;
  name: string;
  facilityType: string;
  detailLocation: string | null;
  categoryIds: FacilityCategoryId[];
  acceptedItems: string[];
  openingHours: string | null;
  status: FacilityStatus;
  statusText: string;
  note: string | null;
  externalId: string;
}

function managerNote(row: CsvRow, extra: Array<string | null> = []) {
  const manager = nullableText(row.관리기관명, 200);
  const phone = nullableText(row.관리기관전화번호, 50);
  return joinDetails([
    manager ? `관리기관 ${manager}` : null,
    phone ? `관리기관 연락처 ${phone}` : null,
    ...extra,
  ], 1000);
}

function makeBaseRecord(input: BaseRecordInput): FacilityImportRecord | string {
  const roadAddress = cleanText(input.row.소재지도로명주소, 300);
  const lotAddress = cleanText(input.row.소재지지번주소, 300);
  const address = firstText([roadAddress, lotAddress], 300);
  if (!input.name) return "시설명이 없습니다.";
  if (!address) return "주소가 없습니다.";
  const coordinates = parseKoreanCoordinates(input.row.위도, input.row.경도);
  const providerCode = cleanText(input.row.제공기관코드, 30);
  const managerName = nullableText(input.row.관리기관명 ?? input.row.운영기관명, 200);
  const managerPhone = nullableText(
    input.row.관리기관전화번호 ?? input.row.운영기관전화번호,
    50,
  );
  return {
    sourceKey: sourceKey([
      input.sourceDataset,
      providerCode,
      input.externalId,
      input.name,
      roadAddress,
      lotAddress,
      input.detailLocation,
    ]),
    sourceDataset: input.sourceDataset,
    name: cleanText(input.name, 200),
    facilityType: cleanText(input.facilityType, 100),
    address,
    detailLocation: input.detailLocation,
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    categoryIds: [...new Set(input.categoryIds)],
    acceptedItems: uniqueText(input.acceptedItems),
    openingHours: input.openingHours,
    status: input.status,
    statusText: cleanText(input.statusText, 100),
    verified: 1,
    managerName,
    managerPhone,
    sourceName: firstText([
      input.row.제공기관명,
      input.row.관리기관명,
      input.row.운영기관명,
      input.sourceLabel,
    ], 200),
    sourceUrl: null,
    sourceUpdatedAt: parseDate(input.row.데이터기준일자),
    note: input.note,
  };
}

function mapTrash(row: CsvRow) {
  const rawType = cleanText(row.휴지통종류, 200);
  const categoryIds = categoriesFromText(rawType, []);
  if (categoryIds.length === 0) categoryIds.push("general");
  const acceptedItems = splitItems(rawType).map((item) => (
    item.includes("재활용") ? "재활용품" : item
  ));
  return makeBaseRecord({
    row,
    sourceDataset: "public-trash",
    sourceLabel: "전국휴지통표준데이터",
    name: cleanText(row.설치장소명, 200),
    facilityType: rawType || "공공 휴지통",
    detailLocation: nullableText(row.세부위치, 500),
    categoryIds,
    acceptedItems: acceptedItems.length ? acceptedItems : ["일반쓰레기"],
    openingHours: null,
    status: "available",
    statusText: "공공데이터 등록 시설",
    note: managerNote(row),
    externalId: "",
  });
}

function mapMedicine(row: CsvRow) {
  return makeBaseRecord({
    row,
    sourceDataset: "public-medicine",
    sourceLabel: "전국폐의약품수거함표준데이터",
    name: cleanText(row.설치장소명, 200),
    facilityType: "폐의약품 수거함",
    detailLocation: nullableText(row.세부위치, 500),
    categoryIds: ["medicine"],
    acceptedItems: ["폐의약품"],
    openingHours: null,
    status: "available",
    statusText: "공공데이터 등록 시설",
    note: managerNote(row),
    externalId: "",
  });
}

function mapRecyclingCenter(row: CsvRow) {
  const name = cleanText(row.재활용센터명, 200);
  const acceptedText = cleanText(row.주요취급품목정보, 1000);
  const suspended = /운영중단|운영 중단|폐업|휴업/.test(name);
  const weekdayStart = cleanText(row.평일운영시작시각, 20);
  const weekdayEnd = cleanText(row.평일운영종료시각, 20);
  const holidayStart = cleanText(row.공휴일운영시작시각, 20);
  const holidayEnd = cleanText(row.공휴일운영종료시각, 20);
  const openingHours = joinDetails([
    weekdayStart && weekdayEnd ? `평일 ${weekdayStart}~${weekdayEnd}` : null,
    holidayStart && holidayEnd ? `공휴일 ${holidayStart}~${holidayEnd}` : null,
    nullableText(row.휴무일정보, 100),
  ], 200);
  return makeBaseRecord({
    row,
    sourceDataset: "public-recycling-center",
    sourceLabel: "전국재활용센터표준데이터",
    name,
    facilityType: firstText([
      row.재활용센터운영구분 ? `${row.재활용센터운영구분} 재활용센터` : "",
      "재활용센터",
    ], 100),
    detailLocation: null,
    categoryIds: categoriesFromText(acceptedText, ["recycle"]),
    acceptedItems: splitItems(acceptedText),
    openingHours,
    status: suspended ? "unavailable" : "available",
    statusText: suspended ? "운영 중단 확인 필요" : "공공데이터 등록 시설",
    note: managerNote(row, [
      nullableText(row.애프터서비스정보, 300),
      nullableText(row.홈페이지주소, 300),
    ]),
    externalId: "",
  });
}

function mapBatteryLamp(row: CsvRow) {
  const itemsText = cleanText(row.수거품목명, 1000);
  const quantity = cleanText(row.수거함수량, 20);
  return makeBaseRecord({
    row,
    sourceDataset: "public-battery-lamp",
    sourceLabel: "전국폐형광등폐건전지수거함표준데이터",
    name: cleanText(row.설치장소명, 200),
    facilityType: "폐형광등·폐건전지 수거함",
    detailLocation: nullableText(row.세부위치내용, 500),
    categoryIds: ["battery"],
    acceptedItems: splitItems(itemsText),
    openingHours: null,
    status: "available",
    statusText: "공공데이터 등록 시설",
    note: managerNote(row, [quantity ? `수거함 ${quantity}개` : null]),
    externalId: "",
  });
}

function mapClothes(row: CsvRow) {
  return makeBaseRecord({
    row,
    sourceDataset: "public-clothes",
    sourceLabel: "전국의류수거함표준데이터",
    name: cleanText(row.설치장소명, 200),
    facilityType: "의류 수거함",
    detailLocation: nullableText(row.상세위치, 500),
    categoryIds: ["clothes"],
    acceptedItems: ["헌옷", "의류"],
    openingHours: null,
    status: "available",
    statusText: "공공데이터 등록 시설",
    note: managerNote(row),
    externalId: cleanText(row.관리번호, 80),
  });
}

export const csvSourceDefinitions: CsvSourceDefinition[] = [
  {
    sourceDataset: "public-trash",
    sourceLabel: "전국휴지통표준데이터",
    fileName: "전국휴지통표준데이터.csv",
    requiredHeaders: ["설치장소명", "소재지도로명주소", "소재지지번주소", "위도", "경도", "휴지통종류"],
    map: mapTrash,
  },
  {
    sourceDataset: "public-medicine",
    sourceLabel: "전국폐의약품수거함표준데이터",
    fileName: "전국폐의약품수거함표준데이터.csv",
    requiredHeaders: ["설치장소명", "소재지도로명주소", "소재지지번주소", "위도", "경도"],
    map: mapMedicine,
  },
  {
    sourceDataset: "public-recycling-center",
    sourceLabel: "전국재활용센터표준데이터",
    fileName: "전국재활용센터표준데이터.csv",
    requiredHeaders: ["재활용센터명", "소재지도로명주소", "소재지지번주소", "위도", "경도", "주요취급품목정보"],
    map: mapRecyclingCenter,
  },
  {
    sourceDataset: "public-battery-lamp",
    sourceLabel: "전국폐형광등폐건전지수거함표준데이터",
    fileName: "전국폐형광등폐건전지수거함표준데이터.csv",
    requiredHeaders: ["설치장소명", "소재지도로명주소", "소재지지번주소", "위도", "경도", "수거품목명"],
    map: mapBatteryLamp,
  },
  {
    sourceDataset: "public-clothes",
    sourceLabel: "전국의류수거함표준데이터",
    fileName: "전국의류수거함표준데이터.csv",
    requiredHeaders: ["관리번호", "설치장소명", "소재지도로명주소", "소재지지번주소", "위도", "경도"],
    map: mapClothes,
  },
];

async function containsAllCsvFiles(directory: string) {
  try {
    await Promise.all(csvSourceDefinitions.map((source) => access(join(directory, source.fileName))));
    return true;
  } catch {
    return false;
  }
}

export async function resolveCsvDirectory(requestedDirectory?: string) {
  const candidates = uniqueText([
    requestedDirectory ?? "",
    process.env.IMPORT_CSV_DIR ?? "",
    resolve(process.cwd(), "data"),
    resolve(process.cwd(), "backend", "data"),
    join(homedir(), "Downloads"),
  ], 10, 1000);
  for (const candidate of candidates) {
    const directory = resolve(candidate);
    if (await containsAllCsvFiles(directory)) return directory;
  }
  throw new Error("현재 데이터 파일을 불러오지 못했습니다.");
}

async function loadCsvSource(directory: string, source: CsvSourceDefinition) {
  const file = await readFile(join(directory, source.fileName));
  const text = new TextDecoder("euc-kr").decode(file);
  const rows = parse(text, {
    columns: true,
    bom: true,
    skip_empty_lines: true,
    relax_column_count: true,
    relax_quotes: true,
    trim: true,
  }) as CsvRow[];
  const headers = new Set(Object.keys(rows[0] ?? {}));
  const missingHeaders = source.requiredHeaders.filter((header) => !headers.has(header));
  if (missingHeaders.length) {
    throw new Error(`${source.fileName} 필수 열 누락: ${missingHeaders.join(", ")}`);
  }
  const result: SourceLoadResult = {
    sourceDataset: source.sourceDataset,
    sourceLabel: source.sourceLabel,
    inputRows: rows.length,
    records: [],
    rejected: [],
  };
  rows.forEach((row, index) => {
    const mapped = source.map(row);
    if (typeof mapped === "string") {
      result.rejected.push({
        rowNumber: index + 2,
        name: nullableText(row.설치장소명 ?? row.재활용센터명, 200),
        reason: mapped,
      });
      return;
    }
    result.records.push(mapped);
  });
  return result;
}

export function loadCsvFacilities(directory: string) {
  return Promise.all(csvSourceDefinitions.map((source) => loadCsvSource(directory, source)));
}
