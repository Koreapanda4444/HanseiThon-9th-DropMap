import { notFound } from "next/navigation";
import { FacilityDetailExperience } from "@/components/facilities/facility-detail-view";

export default async function FacilityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numericId = Number(id);
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(numericId) || numericId <= 0) notFound();
  return <FacilityDetailExperience id={id} />;
}
