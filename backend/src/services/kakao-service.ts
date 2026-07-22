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

export async function geocodeAddress(query: string) {
  if (!env.KAKAO_REST_API_KEY) {
    throw new AppError("Kakao REST API 키가 설정되지 않았습니다.", 503, "KAKAO_NOT_CONFIGURED");
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
