import type { Metadata } from "next";
import { SearchExperience } from "@/components/search/search-experience";

export const metadata: Metadata = { title: "품목 검색" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const query = (await searchParams).q;
  return <SearchExperience initialQuery={typeof query === "string" ? query.slice(0, 200) : ""} />;
}
