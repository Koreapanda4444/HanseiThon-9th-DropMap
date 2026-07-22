"use client";

import { useQuery } from "@tanstack/react-query";
import { Bookmark, Map, Search, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { FacilityCard } from "@/components/facilities/facility-card";
import { PageHeader } from "@/components/ui/page-header";
import { fetchFacilities } from "@/lib/api";
import { useAppStore } from "@/store/use-app-store";

export function FavoritesExperience() {
  const favoriteIds = useAppStore((state) => state.favoriteIds);
  const [query, setQuery] = useState("");
  const facilitiesQuery = useQuery({
    queryKey: ["favorite-facilities", favoriteIds],
    queryFn: ({ signal }) => fetchFacilities({ ids: favoriteIds }, signal),
    enabled: favoriteIds.length > 0,
  });
  const favorites = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ko");
    return (facilitiesQuery.data ?? [])
      .filter((facility) => !normalized || [facility.name, facility.address, ...facility.acceptedItems].join(" ").toLocaleLowerCase("ko").includes(normalized))
      .sort((a, b) => (a.distanceM ?? Number.POSITIVE_INFINITY) - (b.distanceM ?? Number.POSITIVE_INFINITY));
  }, [facilitiesQuery.data, query]);

  return (
    <div className="min-h-[calc(100dvh-138px)] px-4 py-6 sm:px-6 lg:min-h-[calc(100dvh-68px)] lg:py-10">
      <div className="mx-auto max-w-[1100px]">
        <PageHeader title="저장한 장소" description="자주 가는 수거함을 모아두고 빠르게 확인하세요." action={<span className="hidden rounded-full bg-[var(--brand-soft)] px-3 py-1.5 text-[12px] font-extrabold text-[var(--brand-deep)] sm:inline">{favoriteIds.length}곳 저장됨</span>} />

        <div className="mt-6 flex flex-col gap-3 rounded-[22px] border border-[var(--line)] bg-white p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <label className="flex h-11 flex-1 items-center gap-2.5 rounded-xl bg-[var(--surface-muted)] px-3.5 sm:max-w-md">
            <Search className="size-[18px] text-[#86928c]" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="저장한 장소 검색" className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold outline-none placeholder:text-[#9aa49f]" />
          </label>
          <Link href="/" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-4 text-[12px] font-extrabold text-white"><Map className="size-4" /> 지도에서 보기</Link>
        </div>

        {facilitiesQuery.isPending && favoriteIds.length > 0 ? (
          <section className="mt-6 grid gap-4 md:grid-cols-2">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-52 animate-pulse rounded-[22px] bg-[#eef2ef]" />)}</section>
        ) : facilitiesQuery.isError ? (
          <div className="mt-6 rounded-[26px] border border-rose-100 bg-white px-5 py-16 text-center"><TriangleAlert className="mx-auto size-8 text-rose-500" /><h2 className="mt-4 text-[17px] font-black">저장한 장소를 불러오지 못했습니다.</h2><button type="button" onClick={() => facilitiesQuery.refetch()} className="mt-4 rounded-xl bg-[var(--brand)] px-4 py-2.5 text-[12px] font-extrabold text-white">다시 시도</button></div>
        ) : favorites.length > 0 ? (
          <section className="mt-6 grid gap-4 md:grid-cols-2" aria-label="저장한 수거함 목록">
            {favorites.map((facility) => <FacilityCard key={facility.id} facility={facility} />)}
          </section>
        ) : favoriteIds.length > 0 ? (
          <div className="mt-6 rounded-[26px] border border-[var(--line)] bg-white px-5 py-16 text-center">
            <Search className="mx-auto size-8 text-[#a3ada8]" /><h2 className="mt-4 text-[17px] font-black">표시할 장소가 없습니다.</h2><p className="mt-1 text-[13px] text-[var(--sub)]">검색 조건과 일치하는 저장 장소가 없습니다.</p>
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-[28px] border border-[var(--line)] bg-white px-5 py-14 text-center">
            <span className="mx-auto grid size-16 place-items-center rounded-[22px] bg-[var(--brand-soft)] text-[var(--brand-deep)]"><Bookmark className="size-7" /></span>
            <h2 className="mt-5 text-[20px] font-black tracking-[-0.04em]">아직 저장한 장소가 없어요</h2>
            <Link href="/" className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-[var(--brand)] px-5 text-[12px] font-extrabold text-white"><Map className="size-4" /> 지도에서 찾기</Link>
          </div>
        )}
      </div>
    </div>
  );
}
