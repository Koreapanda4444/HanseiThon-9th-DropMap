import { env } from "../config/env.js";
import { closeDatabase } from "../database/oracle.js";
import { loadCsvFacilities, resolveCsvDirectory } from "./csv-sources.js";
import { geocodeMissingFacilities } from "./geocode.js";
import { prepareImport } from "./normalize.js";
import { writeFacilities } from "./oracle-writer.js";
import { loadPublicDataFacilities } from "./public-data.js";
import type { FacilityImportRecord, SourceLoadResult } from "./types.js";

interface CliOptions {
  csvDirectory: string | undefined;
  dryRun: boolean;
  skipOpenApi: boolean;
  skipGeocoding: boolean;
  help: boolean;
}

function parseArguments(values: string[]): CliOptions {
  const options: CliOptions = {
    csvDirectory: undefined,
    dryRun: false,
    skipOpenApi: false,
    skipGeocoding: false,
    help: false,
  };
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--dry-run") options.dryRun = true;
    else if (value === "--skip-openapi" || value === "--csv-only") options.skipOpenApi = true;
    else if (value === "--skip-geocoding") options.skipGeocoding = true;
    else if (value === "--help" || value === "-h") options.help = true;
    else if (value === "--csv-dir") {
      options.csvDirectory = values[index + 1];
      index += 1;
    } else if (value?.startsWith("--csv-dir=")) {
      options.csvDirectory = value.slice("--csv-dir=".length);
    } else {
      throw new Error(`알 수 없는 옵션: ${value}`);
    }
  }
  return options;
}

function printHelp() {
  console.log([
    "사용법: npm run data:import -- [옵션]",
    "--csv-dir <경로>     로컬 데이터 파일이 있는 폴더",
    "--dry-run            저장하지 않고 검증 결과만 출력",
    "--skip-openapi       중소형 폐가전 OpenAPI 수집 제외",
    "--skip-geocoding     좌표가 없는 CSV 행의 Kakao 주소 검색 제외",
  ].join("\n"));
}

function sourceSummary(source: SourceLoadResult) {
  const missingCoordinates = source.records.filter(
    (record) => record.latitude === null || record.longitude === null,
  ).length;
  return {
    sourceDataset: source.sourceDataset,
    sourceLabel: source.sourceLabel,
    inputRows: source.inputRows,
    normalizedRows: source.records.length,
    rejectedRows: source.rejected.length,
    missingCoordinates,
  };
}

function rejectedSamples(sources: SourceLoadResult[]) {
  return sources.flatMap((source) => source.rejected.map((rejected) => ({
    sourceDataset: source.sourceDataset,
    ...rejected,
  }))).slice(0, 20);
}

async function loadSources(options: CliOptions, csvDirectory: string) {
  const sources = await loadCsvFacilities(csvDirectory);
  if (!options.skipOpenApi) {
    if (!env.PUBLIC_DATA_SERVICE_KEY) {
      throw new Error("중소형 폐가전 데이터를 불러오지 못했습니다.");
    }
    sources.push(await loadPublicDataFacilities(env.PUBLIC_DATA_SERVICE_KEY));
  }
  return sources;
}

async function applyGeocoding(records: FacilityImportRecord[], options: CliOptions) {
  const missing = records.filter(
    (record) => record.latitude === null || record.longitude === null,
  ).length;
  if (!missing || options.skipGeocoding) {
    return { records, attempted: 0, resolved: 0, unresolved: missing };
  }
  if (!env.KAKAO_REST_API_KEY) {
    throw new Error("현재 좌표 보완 기능을 이용할 수 없습니다.");
  }
  return geocodeMissingFacilities(records, env.KAKAO_REST_API_KEY);
}

async function run() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }
  const csvDirectory = await resolveCsvDirectory(options.csvDirectory);
  const sources = await loadSources(options, csvDirectory);
  const geocoding = await applyGeocoding(sources.flatMap((source) => source.records), options);
  const prepared = prepareImport(geocoding.records);
  const summary = {
    csvDirectory,
    mode: options.dryRun ? "dry-run" : "import",
    sources: sources.map(sourceSummary),
    totals: {
      inputRows: sources.reduce((sum, source) => sum + source.inputRows, 0),
      rejectedRows: sources.reduce((sum, source) => sum + source.rejected.length, 0),
      duplicateRows: prepared.duplicateRows,
      geocodingAttempted: geocoding.attempted,
      geocodingResolved: geocoding.resolved,
      missingCoordinates: prepared.missingCoordinates,
      readyRecords: prepared.records.length,
    },
    rejectedSamples: rejectedSamples(sources),
  };
  if (options.dryRun) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }
  const imported = await writeFacilities(prepared.records);
  console.log(JSON.stringify({ ...summary, imported }, null, 2));
}

try {
  await run();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
