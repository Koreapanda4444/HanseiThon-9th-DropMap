import type { Facility, FacilityCategory, FacilityCategoryId } from "@/types/domain";

export const FACILITY_CATEGORIES: FacilityCategory[] = [
  { id: "general", label: "일반 쓰레기통", shortLabel: "일반", color: "#3b82f6", softColor: "#eaf2ff" },
  { id: "recycle", label: "재활용 수거함", shortLabel: "재활용", color: "#0f9f6e", softColor: "#e6f7f0" },
  { id: "medicine", label: "폐의약품 수거함", shortLabel: "폐의약품", color: "#8b5cf6", softColor: "#f1ebff" },
  { id: "battery", label: "폐건전지·형광등 수거함", shortLabel: "건전지·형광등", color: "#f97316", softColor: "#fff0e5" },
  { id: "clothes", label: "의류 수거함", shortLabel: "의류", color: "#d97706", softColor: "#fff7df" },
  { id: "cigarette", label: "담배꽁초 수거함", shortLabel: "꽁초", color: "#64748b", softColor: "#eef2f6" },
];

export const CATEGORY_BY_ID = Object.fromEntries(
  FACILITY_CATEGORIES.map((category) => [category.id, category]),
) as Record<FacilityCategoryId, FacilityCategory>;

export function getPrimaryCategory(facility: Facility) {
  return CATEGORY_BY_ID[facility.categoryIds[0] ?? "general"];
}
