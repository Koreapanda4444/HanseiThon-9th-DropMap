import type { Metadata } from "next";
import { ReportExperience } from "@/components/facilities/report-experience";

export const metadata: Metadata = { title: "수거함 제보" };

export default async function ReportPage({ searchParams }: {
  searchParams: Promise<{ facilityId?: string }>;
}) {
  const { facilityId } = await searchParams;
  const numericId = Number(facilityId);
  const validFacilityId = facilityId && /^\d+$/.test(facilityId) && Number.isSafeInteger(numericId) && numericId > 0
    ? facilityId
    : null;
  return <ReportExperience initialFacilityId={validFacilityId} />;
}
