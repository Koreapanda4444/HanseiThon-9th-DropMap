import { DirectionsExperience } from "@/components/facilities/directions-view";

export default async function DirectionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DirectionsExperience id={id} />;
}
