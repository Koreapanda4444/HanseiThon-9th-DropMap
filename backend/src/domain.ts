export const facilityCategoryIds = [
  "general",
  "recycle",
  "medicine",
  "battery",
  "clothes",
  "cigarette",
] as const;

export type FacilityCategoryId = typeof facilityCategoryIds[number];
export type FacilityStatus = "available" | "busy" | "unavailable";
export type ReportType = "full" | "missing" | "broken" | "location" | "info";
export type ReportStatus = "received" | "reviewing" | "resolved";

export interface Facility {
  id: string;
  name: string;
  type: string;
  address: string;
  detailLocation: string | null;
  distanceM: number | null;
  walkMinutes: number | null;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  categoryIds: FacilityCategoryId[];
  acceptedItems: string[];
  openingHours: string | null;
  status: FacilityStatus;
  statusText: string;
  updatedAt: string | null;
  verified: boolean;
  source: string | null;
  note: string | null;
}

export interface WasteItem {
  id: string;
  name: string;
  aliases: string[];
  categoryId: FacilityCategoryId;
  disposalTip: string;
}

export interface ClassificationResult {
  id: string;
  displayName: string;
  categoryId: FacilityCategoryId;
  confidence: number;
  disposalTip: string;
}

export interface UserReport {
  id: string;
  facilityId: string;
  facilityName: string;
  type: ReportType;
  content: string;
  createdAt: string;
  status: ReportStatus;
}
