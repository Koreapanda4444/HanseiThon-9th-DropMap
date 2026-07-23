import { isIP } from "node:net";
import { z } from "zod";
import { env } from "../config/env.js";
import { AppError } from "../errors.js";
import { readLimitedResponseText } from "./http-response.js";

const shortText = z.string().max(500);
const coordinateText = z.string().max(40);
const kakaoAddressResponseSchema = z.object({
  documents: z.array(z.object({
    address_name: shortText,
    x: coordinateText,
    y: coordinateText,
    address: z.object({ address_name: shortText.optional() }).nullable().optional(),
    road_address: z.object({ address_name: shortText.optional() }).nullable().optional(),
  })).max(30).default([]),
});
const kakaoKeywordResponseSchema = z.object({
  documents: z.array(z.object({
    id: z.string().max(100),
    place_name: shortText,
    category_name: shortText.default(""),
    category_group_name: shortText.default(""),
    phone: z.string().max(100).default(""),
    address_name: shortText.default(""),
    road_address_name: shortText.default(""),
    x: coordinateText,
    y: coordinateText,
    distance: coordinateText.default(""),
    place_url: z.string().max(2000).default(""),
  })).max(15).default([]),
});
const kakaoImageResponseSchema = z.object({
  documents: z.array(z.object({
    thumbnail_url: z.string().max(4000).default(""),
    image_url: z.string().max(4000).default(""),
    display_sitename: shortText.default(""),
    doc_url: z.string().max(4000).default(""),
  })).max(1).default([]),
});

interface RouteCoordinate {
  latitude: number;
  longitude: number;
}

function safeHttpsUrl(value: string) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.username || url.password) return null;
    if (url.protocol === "http:") url.protocol = "https:";
    const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
    if (url.protocol !== "https:" || (url.port && url.port !== "443")) return null;
    if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || isIP(hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

const finiteNumber = z.number().finite();
const kakaoDirectionsResponseSchema = z.object({
  routes: z.array(z.object({
    result_code: z.number().int().optional(),
    result_msg: shortText.optional(),
    summary: z.object({
      distance: finiteNumber.optional(),
      duration: finiteNumber.optional(),
      fare: z.object({
        taxi: finiteNumber.optional(),
        toll: finiteNumber.optional(),
      }).optional(),
    }).optional(),
    sections: z.array(z.object({
      roads: z.array(z.object({
        name: shortText.optional(),
        vertexes: z.array(finiteNumber).max(250_000).optional(),
      })).max(10_000).optional(),
      guides: z.array(z.object({
        name: shortText.optional(),
        x: finiteNumber.optional(),
        y: finiteNumber.optional(),
        type: z.number().int().optional(),
        road_index: z.number().int().optional(),
        distance: finiteNumber.optional(),
        duration: finiteNumber.optional(),
        guidance: z.string().max(1000).optional(),
      })).max(5000).optional(),
    })).max(100).optional(),
  })).max(10).default([]),
});

function kakaoUnavailable(message: string, code: string) {
  return new AppError(message, 502, code);
}

async function requestKakao(url: URL, timeout: number, message: string, code: string) {
  try {
    const response = await fetch(url, {
      headers: { Authorization: `KakaoAK ${env.KAKAO_REST_API_KEY}` },
      signal: AbortSignal.timeout(timeout),
      redirect: "error",
    });
    if (!response.ok) throw kakaoUnavailable(message, code);
    return response;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw kakaoUnavailable(message, code);
  }
}

async function readJson<T>(
  response: Response,
  schema: z.ZodType<T>,
  maximumBytes: number,
  message: string,
  code: string,
) {
  let text: string;
  try {
    text = await readLimitedResponseText(response, maximumBytes);
  } catch {
    throw kakaoUnavailable(message, code);
  }
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw kakaoUnavailable(message, code);
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw kakaoUnavailable(message, code);
  return parsed.data;
}

function coordinates(latitudeValue: string | number, longitudeValue: string | number) {
  const latitude = Number(latitudeValue);
  const longitude = Number(longitudeValue);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

function nonnegativeNumber(value: string | number | undefined) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function routePointsForResponse(points: RouteCoordinate[]) {
  const maximumPoints = 12_000;
  if (points.length <= maximumPoints) return points;
  const sampled = Array.from({ length: maximumPoints }, (_, index) => {
    const sourceIndex = Math.round(index * (points.length - 1) / (maximumPoints - 1));
    return points[sourceIndex]!;
  });
  return sampled;
}

function contextualGuideInstruction(
  guide: { guidance?: string | undefined; name?: string | undefined; type?: number | undefined },
  roadName: string | null,
) {
  const guidance = guide.guidance?.trim() ?? "";
  const landmark = guide.name?.trim() ?? "";
  if (guide.type === 100) return "경로 안내를 시작합니다.";
  if (guide.type === 101) return "목적지에 도착했습니다.";

  const maneuver = guidance || landmark || "경로를 따라 이동하세요.";
  const locationContext = landmark && !maneuver.includes(landmark) ? `${landmark}에서 ` : "";
  const directionContext = roadName
    && !maneuver.includes(roadName)
    && !maneuver.includes("방면")
    && /(좌회전|우회전|방향|직진|유턴|진입|출구)/.test(maneuver)
    ? `${roadName} 방면으로 `
    : "";
  return `${locationContext}${directionContext}${maneuver}`;
}

export async function geocodeAddress(query: string) {
  if (!env.KAKAO_REST_API_KEY) {
    throw new AppError("현재 주소 검색을 이용할 수 없습니다.", 503, "KAKAO_NOT_CONFIGURED");
  }

  const url = new URL("https://dapi.kakao.com/v2/local/search/address.json");
  url.searchParams.set("query", query);
  const message = "주소를 좌표로 변환하지 못했습니다.";
  const response = await requestKakao(url, 7000, message, "KAKAO_REQUEST_FAILED");
  const data = await readJson(response, kakaoAddressResponseSchema, 512 * 1024, message, "KAKAO_RESPONSE_INVALID");
  return data.documents.flatMap((document) => {
    const point = coordinates(document.y, document.x);
    return point ? [{
      address: document.address_name,
      roadAddress: document.road_address?.address_name ?? null,
      lotAddress: document.address?.address_name ?? null,
      ...point,
    }] : [];
  });
}

export async function searchPlaces(query: string, latitude?: number, longitude?: number, limit = 15) {
  if (!env.KAKAO_REST_API_KEY) {
    throw new AppError("현재 장소 검색을 이용할 수 없습니다.", 503, "KAKAO_NOT_CONFIGURED");
  }

  const url = new URL("https://dapi.kakao.com/v2/local/search/keyword.json");
  url.searchParams.set("query", query);
  url.searchParams.set("size", String(Math.min(15, Math.max(1, limit))));
  if (latitude !== undefined && longitude !== undefined) {
    url.searchParams.set("y", String(latitude));
    url.searchParams.set("x", String(longitude));
  }
  const message = "장소 검색 결과를 불러오지 못했습니다.";
  const response = await requestKakao(url, 7000, message, "KAKAO_REQUEST_FAILED");
  const data = await readJson(response, kakaoKeywordResponseSchema, 1024 * 1024, message, "KAKAO_RESPONSE_INVALID");
  return data.documents.flatMap((document) => {
    const point = coordinates(document.y, document.x);
    if (!point) return [];
    return [{
      id: document.id,
      name: document.place_name,
      category: document.category_name,
      categoryGroup: document.category_group_name,
      address: document.address_name,
      roadAddress: document.road_address_name || null,
      phone: document.phone || null,
      placeUrl: safeHttpsUrl(document.place_url),
      distanceM: document.distance ? nonnegativeNumber(document.distance) : null,
      coordinates: point,
    }];
  });
}

export async function searchPlaceImage(query: string) {
  if (!env.KAKAO_REST_API_KEY) {
    throw new AppError("현재 장소 이미지를 이용할 수 없습니다.", 503, "KAKAO_NOT_CONFIGURED");
  }

  const url = new URL("https://dapi.kakao.com/v2/search/image");
  url.searchParams.set("query", query);
  url.searchParams.set("size", "1");
  const message = "장소 이미지를 불러오지 못했습니다.";
  const response = await requestKakao(url, 7000, message, "KAKAO_REQUEST_FAILED");
  const data = await readJson(response, kakaoImageResponseSchema, 512 * 1024, message, "KAKAO_RESPONSE_INVALID");
  const image = data.documents[0];
  if (!image) return null;
  const thumbnailUrl = safeHttpsUrl(image.thumbnail_url);
  const imageUrl = safeHttpsUrl(image.image_url);
  if (!thumbnailUrl && !imageUrl) return null;
  return {
    thumbnailUrl: thumbnailUrl ?? imageUrl,
    imageUrl: imageUrl ?? thumbnailUrl,
    sourceName: image.display_sitename || null,
    sourceUrl: safeHttpsUrl(image.doc_url),
  };
}

export async function getDirections(origin: RouteCoordinate, destination: RouteCoordinate) {
  if (!env.KAKAO_REST_API_KEY) {
    throw new AppError("현재 길찾기를 이용할 수 없습니다.", 503, "KAKAO_NOT_CONFIGURED");
  }
  if (!coordinates(origin.latitude, origin.longitude) || !coordinates(destination.latitude, destination.longitude)) {
    throw new AppError("출발지와 목적지 위치를 확인해 주세요.", 400, "DIRECTIONS_COORDINATES_INVALID");
  }

  const url = new URL("https://apis-navi.kakaomobility.com/v1/directions");
  url.searchParams.set("origin", `${origin.longitude},${origin.latitude}`);
  url.searchParams.set("destination", `${destination.longitude},${destination.latitude}`);
  url.searchParams.set("priority", "RECOMMEND");
  const message = "경로를 불러오지 못했습니다.";
  const response = await requestKakao(url, 12_000, message, "DIRECTIONS_REQUEST_FAILED");
  const data = await readJson(response, kakaoDirectionsResponseSchema, 8 * 1024 * 1024, message, "DIRECTIONS_INVALID");
  const route = data.routes[0];
  if (!route || route.result_code !== 0 || !route.summary) {
    throw new AppError("선택한 위치 사이의 경로를 찾지 못했습니다.", 404, "DIRECTIONS_NOT_FOUND");
  }

  const points: RouteCoordinate[] = [];
  for (const section of route.sections ?? []) {
    for (const road of section.roads ?? []) {
      const values = road.vertexes ?? [];
      for (let index = 0; index + 1 < values.length; index += 2) {
        const longitude = values[index];
        const latitude = values[index + 1];
        if (longitude === undefined || latitude === undefined) continue;
        const point = coordinates(latitude, longitude);
        if (!point) continue;
        const previous = points[points.length - 1];
        if (!previous || previous.latitude !== point.latitude || previous.longitude !== point.longitude) points.push(point);
      }
    }
  }
  if (points.length < 2) {
    throw new AppError("경로 좌표를 확인하지 못했습니다.", 502, "DIRECTIONS_INVALID");
  }

  const steps = (route.sections ?? []).flatMap((section) => (section.guides ?? []).map((guide) => {
    const roadIndex = guide.road_index;
    const rawRoadName = roadIndex !== undefined && roadIndex >= 0 ? section.roads?.[roadIndex]?.name : undefined;
    const roadName = rawRoadName?.trim() || null;
    const landmark = guide.name?.trim() || null;
    return { guide, roadName, landmark };
  })).slice(0, 500).map(({ guide, roadName, landmark }, index) => ({
    id: `step-${index + 1}`,
    instruction: contextualGuideInstruction(guide, roadName),
    landmark,
    roadName,
    distanceM: nonnegativeNumber(guide.distance) ?? 0,
    durationS: nonnegativeNumber(guide.duration) ?? 0,
    coordinates: coordinates(guide.y ?? points[0]!.latitude, guide.x ?? points[0]!.longitude) ?? points[0]!,
  }));

  return {
    distanceM: nonnegativeNumber(route.summary.distance) ?? 0,
    durationS: nonnegativeNumber(route.summary.duration) ?? 0,
    taxiFare: nonnegativeNumber(route.summary.fare?.taxi) ?? 0,
    tollFare: nonnegativeNumber(route.summary.fare?.toll) ?? 0,
    points: routePointsForResponse(points),
    steps,
  };
}
