import type { FacilityCategoryId, FacilityStatus } from "../domain.js";

export interface FacilityImportRecord {
  sourceKey: string;
  sourceDataset: string;
  name: string;
  facilityType: string;
  address: string;
  detailLocation: string | null;
  latitude: number | null;
  longitude: number | null;
  categoryIds: FacilityCategoryId[];
  acceptedItems: string[];
  openingHours: string | null;
  status: FacilityStatus;
  statusText: string;
  verified: number;
  managerName: string | null;
  managerPhone: string | null;
  sourceName: string;
  sourceUrl: string | null;
  sourceUpdatedAt: Date | null;
  note: string | null;
}

export interface RejectedImportRow {
  rowNumber: number;
  name: string | null;
  reason: string;
}

export interface SourceLoadResult {
  sourceDataset: string;
  sourceLabel: string;
  inputRows: number;
  records: FacilityImportRecord[];
  rejected: RejectedImportRow[];
}

export interface PreparedImport {
  records: FacilityImportRecord[];
  duplicateRows: number;
  missingCoordinates: number;
}
