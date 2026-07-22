import type { Metadata } from "next";
import { ReportExperience } from "@/components/facilities/report-experience";

export const metadata: Metadata = { title: "수거함 제보" };

export default async function ReportPage({ searchParams }: { searchParams: Promise<{ facilityId?: string | string[] }> }) {
  const facilityId = (await searchParams).facilityId;
  return <ReportExperience initialFacilityId={typeof facilityId === "string" ? facilityId : ""} />;
}
