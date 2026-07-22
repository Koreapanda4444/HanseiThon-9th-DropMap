import { notFound } from "next/navigation";
import { DirectionsExperience } from "@/components/facilities/directions-view";

export default async function DirectionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numericId = Number(id);
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(numericId) || numericId <= 0) notFound();
  return <DirectionsExperience id={id} />;
}
