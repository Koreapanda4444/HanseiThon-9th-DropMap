export const facilityCategoryIds = [
  "general",
  "recycle",
  "medicine",
  "battery",
  "clothes",
  "cigarette",
  "electronics",
] as const;

export type FacilityCategoryId = typeof facilityCategoryIds[number];
export type FacilityStatus = "available" | "busy" | "unavailable";

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

export interface Account {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export const reportTypes = ["full", "missing", "broken", "location", "info"] as const;
export type ReportType = typeof reportTypes[number];
export type ReportStatus = "received" | "reviewing" | "resolved";

export interface UserReport {
  id: string;
  userId: string;
  facilityId: string;
  reportType: ReportType;
  content: string;
  status: ReportStatus;
  createdAt: string;
  updatedAt: string;
}
