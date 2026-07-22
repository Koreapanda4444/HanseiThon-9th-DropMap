import { FacilityDetailExperience } from "@/components/facilities/facility-detail-view";

export default async function FacilityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FacilityDetailExperience id={id} />;
}
