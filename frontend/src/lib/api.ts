import type {
  Account,
  ClassificationResult,
  DirectionsRoute,
  Facility,
  FacilityCluster,
  FacilityCategoryId,
  ImageAnalysisItem,
  PlaceImage,
  PlaceSearchResult,
  ServiceHealth,
  ServiceStats,
  UserReport,
  WasteItem,
} from "@/types/domain";

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000").replace(/\/$/, "");

function apiBaseUrl() {
  if (typeof window === "undefined") return API_BASE_URL;
  const url = new URL(API_BASE_URL);
  const localHosts = ["localhost", "127.0.0.1"];
  if (localHosts.includes(url.hostname)) {
    url.hostname = window.location.hostname;
  }
  return url.toString().replace(/\/$/, "");
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface ErrorPayload {
  error?: {
    message?: string;
    code?: string;
  };
}

async function readLimitedResponseText(response: Response, maximumBytes: number) {
  const advertisedLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(advertisedLength) && advertisedLength > maximumBytes) {
    throw new RangeError("Response body exceeds the size limit");
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maximumBytes) {
        await reader.cancel().catch(() => undefined);
        throw new RangeError("Response body exceeds the size limit");
      }
      chunks.push(decoder.decode(value, { stream: true }));
    }
    chunks.push(decoder.decode());
    return chunks.join("");
  } finally {
    reader.releaseLock();
  }
}

async function apiRequest<T>(path: string, init: RequestInit = {}, timeoutMs = 20_000) {
  const method = (init.method || "GET").toUpperCase();
  const stateChanging = !["GET", "HEAD", "OPTIONS"].includes(method);
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (stateChanging) headers.set("X-Requested-With", "beoril-map");
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort(init.signal?.reason);
  if (init.signal?.aborted) abort();
  else init.signal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    let response: Response;
    try {
      response = await fetch(`${apiBaseUrl()}${path}`, {
        ...init,
        credentials: "include",
        headers,
        signal: controller.signal,
      });
    } catch (error) {
      if (init.signal?.aborted) throw error;
      if (timedOut) throw new ApiError("요청 시간이 초과되었습니다. 다시 시도해 주세요.", 0, "REQUEST_TIMEOUT");
      throw new ApiError("현재 서비스를 이용할 수 없습니다. 잠시 후 다시 시도해 주세요.", 0, "NETWORK_ERROR");
    }

    let responseText: string;
    try {
      responseText = await readLimitedResponseText(response, 25 * 1024 * 1024);
    } catch (error) {
      if (init.signal?.aborted) throw error;
      if (timedOut) throw new ApiError("요청 시간이 초과되었습니다. 다시 시도해 주세요.", 0, "REQUEST_TIMEOUT");
      throw new ApiError("서버 응답을 확인하지 못했습니다.", response.status, "INVALID_RESPONSE");
    }
    let parsed: unknown = {};
    if (responseText) {
      try {
        parsed = JSON.parse(responseText);
      } catch {
        throw new ApiError("서버 응답을 확인하지 못했습니다.", response.status, "INVALID_RESPONSE");
      }
    }
    const payload = (typeof parsed === "object" && parsed !== null ? parsed : {}) as T & ErrorPayload;
    if (!response.ok) {
      throw new ApiError(
        payload.error?.message || "요청을 처리하지 못했습니다.",
        response.status,
        payload.error?.code || "REQUEST_FAILED",
      );
    }
    return payload;
  } finally {
    clearTimeout(timeout);
    init.signal?.removeEventListener("abort", abort);
  }
}

export interface FacilityFilters {
  categoryId?: FacilityCategoryId | "all";
  query?: string;
  ids?: string[];
  latitude?: number;
  longitude?: number;
  radiusM?: number;
  west?: number;
  south?: number;
  east?: number;
  north?: number;
  limit?: number;
}

export async function fetchFacilities(filters: FacilityFilters = {}, signal?: AbortSignal): Promise<Facility[]> {
  if (filters.ids && filters.ids.length > 200) {
    const { ids, ...sharedFilters } = filters;
    const batches: string[][] = [];
    for (let index = 0; index < ids.length; index += 200) batches.push(ids.slice(index, index + 200));
    const facilities: Facility[] = (await Promise.all(batches.map((batch) => fetchFacilities({ ...sharedFilters, ids: batch }, signal)))).flat();
    return [...new Map(facilities.map((facility) => [facility.id, facility])).values()];
  }
  const params = new URLSearchParams();
  if (filters.categoryId && filters.categoryId !== "all") params.set("categoryId", filters.categoryId);
  if (filters.query) params.set("query", filters.query);
  if (filters.ids?.length) params.set("ids", filters.ids.join(","));
  if (filters.latitude !== undefined) params.set("latitude", String(filters.latitude));
  if (filters.longitude !== undefined) params.set("longitude", String(filters.longitude));
  if (filters.radiusM !== undefined) params.set("radiusM", String(filters.radiusM));
  if (filters.west !== undefined) params.set("west", String(filters.west));
  if (filters.south !== undefined) params.set("south", String(filters.south));
  if (filters.east !== undefined) params.set("east", String(filters.east));
  if (filters.north !== undefined) params.set("north", String(filters.north));
  if (filters.limit !== undefined) params.set("limit", String(filters.limit));
  const suffix = params.size ? `?${params.toString()}` : "";
  const response = await apiRequest<{ facilities: Facility[] }>(`/api/facilities${suffix}`, { signal });
  return response.facilities;
}

export async function fetchFacilityClusters(filters: {
  categoryId?: FacilityCategoryId | "all";
  west: number;
  south: number;
  east: number;
  north: number;
  columns: number;
  rows: number;
}, signal?: AbortSignal) {
  const params = new URLSearchParams({
    west: String(filters.west),
    south: String(filters.south),
    east: String(filters.east),
    north: String(filters.north),
    columns: String(filters.columns),
    rows: String(filters.rows),
  });
  if (filters.categoryId && filters.categoryId !== "all") params.set("categoryId", filters.categoryId);
  const response = await apiRequest<{ clusters: FacilityCluster[] }>(`/api/facility-clusters?${params.toString()}`, { signal });
  return response.clusters;
}

export async function fetchFacility(id: string, signal?: AbortSignal) {
  const response = await apiRequest<{ facility: Facility }>(`/api/facilities/${encodeURIComponent(id)}`, { signal });
  return response.facility;
}

export async function searchPlaces(query: string, location?: { latitude: number; longitude: number } | null, limit = 15, signal?: AbortSignal) {
  const params = new URLSearchParams({ query });
  params.set("limit", String(limit));
  if (location) {
    params.set("latitude", String(location.latitude));
    params.set("longitude", String(location.longitude));
  }
  const response = await apiRequest<{ results: PlaceSearchResult[] }>(`/api/places?${params.toString()}`, { signal });
  return response.results;
}

export async function fetchPlaceImage(query: string, signal?: AbortSignal) {
  const params = new URLSearchParams({ query });
  const response = await apiRequest<{ result: PlaceImage | null }>(`/api/place-image?${params.toString()}`, { signal });
  return response.result;
}

export async function fetchDirections(origin: { latitude: number; longitude: number }, destination: { latitude: number; longitude: number }, signal?: AbortSignal) {
  const params = new URLSearchParams({
    originLatitude: String(origin.latitude),
    originLongitude: String(origin.longitude),
    destinationLatitude: String(destination.latitude),
    destinationLongitude: String(destination.longitude),
  });
  const response = await apiRequest<{ route: DirectionsRoute }>(`/api/directions?${params.toString()}`, { signal });
  return response.route;
}

export async function fetchWasteItems(signal?: AbortSignal) {
  const response = await apiRequest<{ items: WasteItem[] }>("/api/waste-items?limit=20", { signal });
  return response.items;
}

export async function classifyWaste(query: string) {
  const response = await apiRequest<{ results: ClassificationResult[] }>("/api/classify", {
    method: "POST",
    body: JSON.stringify({ query }),
  });
  return response.results;
}

export async function fetchStats(signal?: AbortSignal) {
  return apiRequest<ServiceStats>("/api/stats", { signal });
}

export async function fetchHealth(signal?: AbortSignal) {
  return apiRequest<ServiceHealth>("/health", { signal });
}

export async function analyzeImage(image: string, signal?: AbortSignal) {
  const response = await apiRequest<{ items: ImageAnalysisItem[] }>("/api/analyze-image", {
    method: "POST",
    body: JSON.stringify({ image }),
    signal,
  }, 60_000);
  return response.items;
}

export async function fetchCurrentAccount(signal?: AbortSignal) {
  const response = await apiRequest<{ user: Account | null }>("/api/auth/me", { signal });
  return response.user;
}

export async function registerAccount(input: { name: string; email: string; password: string }) {
  const response = await apiRequest<{ user: Account }>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return response.user;
}

export async function loginAccount(input: { email: string; password: string }) {
  const response = await apiRequest<{ user: Account }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return response.user;
}

export async function logoutAccount() {
  await apiRequest("/api/auth/logout", { method: "POST" });
}

export async function changeAccountPassword(input: { currentPassword: string; newPassword: string }) {
  await apiRequest("/api/auth/password", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function deleteAccount(password: string) {
  await apiRequest("/api/auth/account", {
    method: "DELETE",
    body: JSON.stringify({ password }),
  });
}

export async function fetchReports(signal?: AbortSignal) {
  const response = await apiRequest<{ reports: UserReport[] }>("/api/reports", { signal });
  return response.reports;
}

export async function submitReport(input: {
  facilityId: string;
  reportType: UserReport["reportType"];
  content: string;
}) {
  const response = await apiRequest<{ report: UserReport }>("/api/reports", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return response.report;
}
