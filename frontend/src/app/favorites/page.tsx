import type { Metadata } from "next";
import { FavoritesExperience } from "@/components/facilities/favorites-experience";

export const metadata: Metadata = { title: "저장한 장소" };

export default function FavoritesPage() {
  return <FavoritesExperience />;
}
