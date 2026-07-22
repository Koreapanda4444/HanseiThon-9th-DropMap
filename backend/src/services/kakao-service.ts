import { env } from "../config/env.js";
import { AppError } from "../errors.js";

interface KakaoAddressDocument {
  address_name: string;
  x: string;
  y: string;
  address?: {
    address_name?: string;
  } | null;
  road_address?: {
    address_name?: string;
  } | null;
}

interface KakaoAddressResponse {
  documents?: KakaoAddressDocument[];
}

interface KakaoKeywordDocument {
  id: string;
  place_name: string;
  category_name: string;
  category_group_name: string;
  phone: string;
  address_name: string;
  road_address_name: string;
  x: string;
  y: string;
  distance: string;
}

interface KakaoKeywordResponse {
  documents?: KakaoKeywordDocument[];
}

export async function geocodeAddress(query: string) {
  if (!env.KAKAO_REST_API_KEY) {
    throw new AppError("현재 주소 검색을 이용할 수 없습니다.", 503, "KAKAO_NOT_CONFIGURED");
  }

  const url = new URL("https://dapi.kakao.com/v2/local/search/address.json");
  url.searchParams.set("query", query);
  const response = await fetch(url, {
    headers: { Authorization: `KakaoAK ${env.KAKAO_REST_API_KEY}` },
    signal: AbortSignal.timeout(7000),
  });

  if (!response.ok) {
    throw new AppError("주소를 좌표로 변환하지 못했습니다.", 502, "KAKAO_REQUEST_FAILED");
  }

  const data = await response.json() as KakaoAddressResponse;
  return (data.documents ?? []).map((document) => ({
    address: document.address_name,
    roadAddress: document.road_address?.address_name ?? null,
    lotAddress: document.address?.address_name ?? null,
    latitude: Number(document.y),
    longitude: Number(document.x),
  }));
}

export async function searchPlaces(query: string, latitude?: number, longitude?: number) {
  if (!env.KAKAO_REST_API_KEY) {
    throw new AppError("현재 장소 검색을 이용할 수 없습니다.", 503, "KAKAO_NOT_CONFIGURED");
  }

  const url = new URL("https://dapi.kakao.com/v2/local/search/keyword.json");
  url.searchParams.set("query", query);
  url.searchParams.set("size", "15");
  if (latitude !== undefined && longitude !== undefined) {
    url.searchParams.set("y", String(latitude));
    url.searchParams.set("x", String(longitude));
  }
  const response = await fetch(url, {
    headers: { Authorization: `KakaoAK ${env.KAKAO_REST_API_KEY}` },
    signal: AbortSignal.timeout(7000),
  });

  if (!response.ok) {
    throw new AppError("장소 검색 결과를 불러오지 못했습니다.", 502, "KAKAO_REQUEST_FAILED");
  }

  const data = await response.json() as KakaoKeywordResponse;
  return (data.documents ?? []).map((document) => ({
    id: document.id,
    name: document.place_name,
    category: document.category_name,
    categoryGroup: document.category_group_name,
    address: document.address_name,
    roadAddress: document.road_address_name || null,
    phone: document.phone || null,
    distanceM: document.distance ? Number(document.distance) : null,
    coordinates: {
      latitude: Number(document.y),
      longitude: Number(document.x),
    },
  }));
}
