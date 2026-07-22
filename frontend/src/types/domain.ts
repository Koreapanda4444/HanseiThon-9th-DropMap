export type FacilityCategoryId =
  | "general"
  | "recycle"
  | "medicine"
  | "battery"
  | "clothes"
  | "cigarette"
  | "electronics";

export type FacilityStatus = "available" | "busy" | "unavailable";
export type ReportType = "full" | "missing" | "broken" | "location" | "info";

export interface FacilityCategory {
  id: FacilityCategoryId;
  label: string;
  shortLabel: string;
  color: string;
  softColor: string;
}

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

export interface PlaceSearchResult {
  id: string;
  name: string;
  category: string;
  categoryGroup: string;
  address: string;
  roadAddress: string | null;
  phone: string | null;
  distanceM: number | null;
  coordinates: {
    latitude: number;
    longitude: number;
  };
}

export interface ServiceStats {
  facilities: number;
  sources: number;
}

export interface ServiceHealth {
  status: "ok" | "degraded";
  service: string;
  dataSource: {
    mode: "oracle" | "local" | "unavailable";
    available: boolean;
  };
  database: {
    configured: boolean;
    connected: boolean;
    state: "unconfigured" | "disconnected" | "connected";
  };
  timestamp: string;
}

export interface Account {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export type ReportStatus = "received" | "reviewing" | "resolved";

export interface UserReport {
  id: string;
  facilityId: string;
  facilityName: string;
  reportType: ReportType;
  content: string;
  status: ReportStatus;
  createdAt: string;
  updatedAt: string;
}
