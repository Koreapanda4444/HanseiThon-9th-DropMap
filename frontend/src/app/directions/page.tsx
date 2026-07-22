import { notFound } from "next/navigation";
import { DirectionsPlanner } from "@/components/facilities/directions-view";

function text(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

export default async function PlaceDirectionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const name = text(params.name).trim();
  const address = text(params.address).trim();
  const latitude = Number(text(params.latitude));
  const longitude = Number(text(params.longitude));
  if (!name || name.length > 200 || address.length > 500 || !Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) notFound();
  return <DirectionsPlanner backHref="/" initialDestination={{ id: `place-${latitude}-${longitude}`, name, address, latitude, longitude }} />;
}
