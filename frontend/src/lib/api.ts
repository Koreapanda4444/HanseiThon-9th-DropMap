import { z } from "zod";
import type {
  ClassificationResult,
  Facility,
  FacilityCategoryId,
  ReportType,
  ServiceHealth,
  ServiceStats,
  UserReport,
  WasteItem,
} from "@/types/domain";

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000").replace(/\/$/, "");

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

async function apiRequest<T>(path: string, init?: RequestInit) {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError("API 서버에 연결할 수 없습니다.", 0, "NETWORK_ERROR");
  }

  const payload = await response.json().catch(() => ({})) as T & ErrorPayload;
  if (!response.ok) {
    throw new ApiError(
      payload.error?.message || "요청을 처리하지 못했습니다.",
      response.status,
      payload.error?.code || "REQUEST_FAILED",
    );
  }
  return payload;
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

export async function fetchFacilities(filters: FacilityFilters = {}) {
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
  const response = await apiRequest<{ facilities: Facility[] }>(`/api/facilities${suffix}`);
  return response.facilities;
}

export async function fetchFacility(id: string) {
  const response = await apiRequest<{ facility: Facility }>(`/api/facilities/${encodeURIComponent(id)}`);
  return response.facility;
}

export async function fetchWasteItems() {
  const response = await apiRequest<{ items: WasteItem[] }>("/api/waste-items?limit=20");
  return response.items;
}

export async function classifyWaste(query: string) {
  const response = await apiRequest<{ results: ClassificationResult[] }>("/api/classify", {
    method: "POST",
    body: JSON.stringify({ query }),
  });
  return response.results;
}

export const reportSchema = z.object({
  facilityId: z.string().regex(/^\d+$/, "장소를 선택해 주세요."),
  deviceId: z.string().uuid(),
  type: z.enum(["full", "missing", "broken", "location", "info"]),
  content: z.string().trim().min(5, "상황을 5자 이상 적어 주세요.").max(300, "내용은 300자까지 입력할 수 있어요."),
});

export interface ReportInput {
  facilityId: string;
  deviceId: string;
  type: ReportType;
  content: string;
}

export async function submitReport(input: ReportInput) {
  const parsed = reportSchema.parse(input);
  const response = await apiRequest<{ report: UserReport }>("/api/reports", {
    method: "POST",
    body: JSON.stringify(parsed),
  });
  return response.report;
}

export async function fetchReports(deviceId: string) {
  const response = await apiRequest<{ reports: UserReport[] }>(`/api/reports/${encodeURIComponent(deviceId)}`);
  return response.reports;
}

export async function fetchStats() {
  return apiRequest<ServiceStats>("/api/stats");
}

export async function fetchHealth() {
  return apiRequest<ServiceHealth>("/health");
}
