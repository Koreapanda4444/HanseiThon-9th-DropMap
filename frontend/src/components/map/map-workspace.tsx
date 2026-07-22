"use client";

import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Layers3, LocateFixed, MapPin, Minus, Plus, Search, Sparkles, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { FacilityCard } from "@/components/facilities/facility-card";
import { CategoryChips } from "@/components/map/category-chips";
import { KakaoMap, type KakaoMapHandle, type MapPoint, type MapViewport } from "@/components/map/kakao-map";
import { BrandMark } from "@/components/ui/brand-mark";
import { fetchFacilities } from "@/lib/api";
import { useAppStore } from "@/store/use-app-store";
import type { Facility } from "@/types/domain";

export function MapWorkspace() {
  const router = useRouter();
  const mapRef = useRef<KakaoMapHandle>(null);
  const selectedCategoryId = useAppStore((state) => state.selectedCategoryId);
  const setSelectedCategoryId = useAppStore((state) => state.setSelectedCategoryId);
  const selectedFacilityId = useAppStore((state) => state.selectedFacilityId);
  const setSelectedFacilityId = useAppStore((state) => state.setSelectedFacilityId);
  const [searchValue, setSearchValue] = useState("");
  const [viewport, setViewport] = useState<MapViewport | null>(null);
  const [userLocation, setUserLocation] = useState<MapPoint | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((position) => {
      setUserLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
    }, () => undefined, { enableHighAccuracy: false, timeout: 5000, maximumAge: 120000 });
  }, []);

  const facilitiesQuery = useQuery({
    queryKey: ["facilities", selectedCategoryId, viewport, userLocation],
    queryFn: () => fetchFacilities({
      categoryId: selectedCategoryId,
      ...(viewport ?? {}),
      ...(userLocation ? { latitude: userLocation.latitude, longitude: userLocation.longitude } : {}),
      limit: 100,
    }),
  });
  const facilities = useMemo(() => facilitiesQuery.data ?? [], [facilitiesQuery.data]);
  const selectedFacility = useMemo(
    () => facilities.find((facility) => facility.id === selectedFacilityId) ?? facilities[0] ?? null,
    [facilities, selectedFacilityId],
  );

  useEffect(() => {
    if (selectedFacility && selectedFacility.id !== selectedFacilityId) {
      setSelectedFacilityId(selectedFacility.id);
    }
    if (!selectedFacility && selectedFacilityId) {
      setSelectedFacilityId(null);
    }
  }, [selectedFacility, selectedFacilityId, setSelectedFacilityId]);

  const handleSelect = useCallback((facility: Facility) => {
    setSelectedFacilityId(facility.id);
  }, [setSelectedFacilityId]);

  const handleViewportChange = useCallback((nextViewport: MapViewport) => {
    setViewport((current) => {
      if (
        current
        && current.west === nextViewport.west
        && current.south === nextViewport.south
        && current.east === nextViewport.east
        && current.north === nextViewport.north
      ) return current;
      return nextViewport;
    });
  }, []);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = searchValue.trim();
    router.push(query ? `/search?q=${encodeURIComponent(query)}` : "/search");
  }

  const listContent = facilitiesQuery.isError ? (
    <div className="rounded-[22px] border border-rose-100 bg-rose-50 px-5 py-10 text-center">
      <TriangleAlert className="mx-auto size-5 text-rose-500" />
      <p className="mt-2 text-[13px] font-bold text-rose-700">시설 데이터를 불러오지 못했습니다.</p>
      <button type="button" onClick={() => facilitiesQuery.refetch()} className="mt-3 rounded-xl bg-white px-3 py-2 text-[11px] font-extrabold text-rose-700">다시 시도</button>
    </div>
  ) : facilities.length === 0 && !facilitiesQuery.isPending ? (
    <div className="rounded-[22px] bg-[var(--surface-muted)] px-5 py-12 text-center text-[14px] text-[var(--sub)]">현재 지도 영역에 등록된 수거함이 없습니다.</div>
  ) : null;

  return (
    <div className="relative flex h-[calc(100dvh-70px-env(safe-area-inset-bottom))] min-h-[560px] overflow-hidden bg-[#edf0e9] lg:h-[calc(100dvh-68px)] lg:min-h-[640px]">
      <aside className="relative z-30 hidden w-[430px] shrink-0 flex-col border-r border-[var(--line)] bg-white shadow-[10px_0_35px_rgba(25,40,35,0.06)] lg:flex xl:w-[455px]">
        <div className="border-b border-[var(--line-soft)] px-6 pb-5 pt-6">
          <p className="text-[12px] font-extrabold tracking-[0.04em] text-[var(--brand-deep)]">내 주변 분리배출</p>
          <h1 className="mt-1.5 text-[27px] font-black tracking-[-0.05em] text-[var(--ink)]">어떤 물건을 버리시나요?</h1>
          <form onSubmit={handleSearch} className="mt-5 flex h-[54px] items-center rounded-2xl border border-[#dce3df] bg-[var(--surface-muted)] px-4 transition focus-within:border-[var(--brand)] focus-within:bg-white focus-within:ring-4 focus-within:ring-[var(--brand)]/10">
            <Search className="size-5 shrink-0 text-[#87938e]" />
            <input value={searchValue} onChange={(event) => setSearchValue(event.target.value)} className="h-full min-w-0 flex-1 bg-transparent px-3 text-[14px] font-semibold text-[var(--ink)] outline-none placeholder:text-[#9aa5a0]" placeholder="버릴 물건 이름을 입력해 주세요" aria-label="버릴 물건 검색" />
            <button type="submit" className="rounded-xl bg-[var(--ink)] px-3 py-2 text-[12px] font-extrabold text-white transition hover:bg-black">검색</button>
          </form>
          <button type="button" onClick={() => router.push("/search")} className="mt-3 flex w-full items-center justify-between rounded-2xl bg-gradient-to-r from-[#e9f8f1] to-[#f3fbf7] p-3.5 text-left transition hover:shadow-sm">
            <span className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-xl bg-white text-[var(--brand-deep)] shadow-sm"><Sparkles className="size-[18px]" /></span>
              <span><strong className="block text-[13px] text-[var(--ink)]">버리는 방법이 헷갈리나요?</strong><span className="text-[11px] text-[var(--sub)]">품목 데이터에서 배출 방법을 찾아보세요</span></span>
            </span>
            <span className="text-[12px] font-extrabold text-[var(--brand-deep)]">찾아보기</span>
          </button>
        </div>

        <div className="px-6 py-4">
          <CategoryChips value={selectedCategoryId} onChange={setSelectedCategoryId} compact />
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-end justify-between px-6 pb-3 pt-1">
            <div>
              <p className="flex items-center gap-1.5 text-[12px] font-bold text-[var(--brand-deep)]"><MapPin className="size-3.5 fill-[var(--brand-soft)]" /> 현재 지도 영역</p>
              <h2 className="mt-1 text-[18px] font-black tracking-[-0.03em] text-[var(--ink)]">수거함 <span className="text-[var(--brand)]">{facilities.length}</span></h2>
            </div>
            <span className="flex items-center gap-1 text-[12px] font-bold text-[var(--sub)]">{userLocation ? "거리순" : "최근 갱신순"}<ChevronDown className="size-3.5" /></span>
          </div>
          <div className="no-scrollbar flex-1 space-y-3 overflow-y-auto px-5 pb-6">
            {facilitiesQuery.isPending && Array.from({ length: 3 }, (_, index) => <div key={index} className="h-[180px] animate-pulse rounded-[22px] bg-[#f1f4f2]" />)}
            {!facilitiesQuery.isPending && facilities.map((facility) => (
              <FacilityCard key={facility.id} facility={facility} selected={facility.id === selectedFacility?.id} onSelect={handleSelect} />
            ))}
            {listContent}
          </div>
        </div>
      </aside>

      <section className="relative min-w-0 flex-1" aria-label="수거함 지도">
        <KakaoMap
          ref={mapRef}
          facilities={facilities}
          selectedId={selectedFacility?.id ?? null}
          onSelect={handleSelect}
          onViewportChange={handleViewportChange}
          onLocationChange={setUserLocation}
          userLocation={userLocation}
          className="size-full"
        />

        <div className="absolute inset-x-0 top-0 z-40 bg-gradient-to-b from-white/90 via-white/45 to-transparent px-4 pb-9 pt-[max(14px,env(safe-area-inset-top))] lg:hidden">
          <div className="flex items-center gap-3">
            <BrandMark compact />
            <button type="button" onClick={() => router.push("/search")} className="flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-2xl bg-white px-4 text-left text-[13px] font-semibold text-[#8b968f] shadow-[0_9px_25px_rgba(34,50,44,0.14)]">
              <Search className="size-[18px] text-[var(--ink)]" /><span className="truncate">무엇을 버리시나요?</span>
            </button>
          </div>
          <CategoryChips value={selectedCategoryId} onChange={setSelectedCategoryId} compact className="mt-3" />
        </div>

        <div className="absolute right-4 top-[165px] z-40 flex flex-col gap-2 lg:right-6 lg:top-6">
          <button type="button" onClick={() => mapRef.current?.locate()} aria-label="내 위치로 이동" className="grid size-11 place-items-center rounded-2xl bg-white text-[#34413c] shadow-[0_8px_22px_rgba(34,50,44,0.15)] transition hover:text-[var(--brand-deep)]"><LocateFixed className="size-5" /></button>
          <div className="hidden overflow-hidden rounded-2xl bg-white shadow-[0_8px_22px_rgba(34,50,44,0.15)] lg:block">
            <button type="button" onClick={() => mapRef.current?.zoomIn()} aria-label="지도 확대" className="grid size-11 place-items-center text-[#34413c] hover:bg-[var(--surface-muted)]"><Plus className="size-5" /></button>
            <div className="mx-2 border-t border-[var(--line)]" />
            <button type="button" onClick={() => mapRef.current?.zoomOut()} aria-label="지도 축소" className="grid size-11 place-items-center text-[#34413c] hover:bg-[var(--surface-muted)]"><Minus className="size-5" /></button>
          </div>
          <button type="button" onClick={() => mapRef.current?.toggleMapType()} aria-label="지도 유형 전환" className="grid size-11 place-items-center rounded-2xl bg-white text-[#34413c] shadow-[0_8px_22px_rgba(34,50,44,0.15)] transition hover:text-[var(--brand-deep)]"><Layers3 className="size-5" /></button>
        </div>

        <div className="absolute left-6 top-6 z-40 hidden items-center gap-2 rounded-full bg-white/95 px-3.5 py-2 text-[11px] font-bold text-[var(--sub)] shadow-lg backdrop-blur lg:flex">
          <span className="size-2 rounded-full bg-[var(--brand)]" /> 지도를 움직이면 현재 영역의 데이터를 조회합니다
        </div>

        <div className="absolute inset-x-0 bottom-0 z-40 lg:hidden">
          <div className="rounded-t-[28px] border-t border-white/70 bg-white/96 px-4 pb-4 pt-2 shadow-[0_-12px_40px_rgba(30,44,39,0.14)] backdrop-blur-xl">
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-[#d7ddd9]" />
            <div className="mb-3 flex items-center justify-between px-1">
              <div><p className="text-[11px] font-bold text-[var(--brand-deep)]">현재 지도 영역</p><h2 className="text-[17px] font-black tracking-[-0.03em] text-[var(--ink)]">수거함 {facilities.length}곳</h2></div>
              <button type="button" onClick={() => router.push("/search")} className="rounded-full bg-[var(--brand-soft)] px-3 py-2 text-[11px] font-extrabold text-[var(--brand-deep)]">품목 검색</button>
            </div>
            <AnimatePresence mode="wait">
              {selectedFacility ? (
                <motion.div key={selectedFacility.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
                  <FacilityCard facility={selectedFacility} compact selected />
                </motion.div>
              ) : (
                <div className="rounded-2xl bg-[var(--surface-muted)] px-4 py-5 text-center text-[12px] text-[var(--sub)]">
                  {facilitiesQuery.isError ? "시설 데이터를 불러오지 못했습니다." : facilitiesQuery.isPending ? "시설 데이터를 불러오는 중입니다." : "현재 영역에 등록된 수거함이 없습니다."}
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </section>
    </div>
  );
}
