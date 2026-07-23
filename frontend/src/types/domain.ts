export type FacilityCategoryId =
  | "general"
  | "recycle"
  | "medicine"
  | "battery"
  | "clothes"
  | "cigarette";

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

export interface FacilityCluster {
  id: string;
  count: number;
  categoryId: FacilityCategoryId | null;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  bounds: {
    west: number;
    south: number;
    east: number;
    north: number;
  };
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

export interface ImageAnalysisItem {
  id: string;
  name: string;
  categoryId: FacilityCategoryId;
  confidence: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
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
  placeUrl: string | null;
  distanceM: number | null;
  coordinates: {
    latitude: number;
    longitude: number;
  };
}

export interface PlaceImage {
  thumbnailUrl: string;
  imageUrl: string;
  sourceName: string | null;
  sourceUrl: string | null;
}

export interface DirectionsRoute {
  distanceM: number;
  durationS: number;
  taxiFare: number;
  tollFare: number;
  points: Array<{
    latitude: number;
    longitude: number;
  }>;
  steps: Array<{
    id: string;
    instruction: string;
    landmark: string | null;
    roadName: string | null;
    distanceM: number;
    durationS: number;
    coordinates: {
      latitude: number;
      longitude: number;
    };
  }>;
}

export interface ServiceStats {
  facilities: number;
  sources: number;
}

export interface ServiceHealth {
  status: "ok" | "degraded";
  service: string;
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
