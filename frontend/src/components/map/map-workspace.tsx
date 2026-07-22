"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { ChevronRight, Layers3, LocateFixed, MapPin, Minus, Plus, Search, TriangleAlert, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useRef, useState, type FormEvent } from "react";
import { FacilityCard } from "@/components/facilities/facility-card";
import { CategoryChips } from "@/components/map/category-chips";
import { KakaoMap, type KakaoMapHandle, type MapFocusPoint, type MapPoint, type MapViewport } from "@/components/map/kakao-map";
import { BrandMark } from "@/components/ui/brand-mark";
import { CategoryIcon } from "@/components/ui/category-icon";
import { getPrimaryCategory } from "@/config/facility-categories";
import { fetchFacilities, searchPlaces } from "@/lib/api";
import { cn, formatDistance } from "@/lib/utils";
import { useAppStore } from "@/store/use-app-store";
import type { Facility, PlaceSearchResult } from "@/types/domain";

function PlaceSearchForm({ value, onChange, onSubmit, onClear, className }: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClear: () => void;
  className?: string;
}) {
  return (
    <form onSubmit={onSubmit} className={cn("flex h-11 items-center rounded-xl border border-[#d8dfdb] bg-white px-3 shadow-[0_4px_14px_rgba(30,45,39,0.08)] transition focus-within:border-[var(--brand)] focus-within:ring-3 focus-within:ring-[var(--brand)]/10", className)}>
      <Search className="size-[18px] shrink-0 text-[#66736d]" />
      <input value={value} onChange={(event) => onChange(event.target.value)} minLength={2} className="h-full min-w-0 flex-1 bg-transparent px-2.5 text-[13px] font-semibold text-[var(--ink)] outline-none placeholder:text-[#98a29d]" placeholder="장소나 주소 검색" aria-label="장소나 주소 검색" />
      {value && <button type="button" onClick={onClear} aria-label="검색어 지우기" className="grid size-7 shrink-0 place-items-center rounded-full text-[#89948f] hover:bg-[var(--surface-muted)]"><X className="size-3.5" /></button>}
      <button type="submit" disabled={value.trim().length < 2} className="ml-1 h-8 shrink-0 rounded-lg bg-[var(--brand)] px-3 text-[11px] font-extrabold text-white disabled:bg-[#b8c4be]">검색</button>
    </form>
  );
}

function PlaceResultRow({ place, selected, onSelect }: {
  place: PlaceSearchResult;
  selected: boolean;
  onSelect: (place: PlaceSearchResult) => void;
}) {
  const category = place.categoryGroup || place.category.split(" > ").at(-1) || "장소";
  return (
    <button type="button" onClick={() => onSelect(place)} className={cn("flex w-full items-start gap-3 border-b border-[var(--line-soft)] px-4 py-3.5 text-left transition hover:bg-[#f7faf8]", selected && "bg-[var(--brand-pale)]")}>
      <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-full", selected ? "bg-[var(--brand)] text-white" : "bg-[#eef2ef] text-[#66736d]")}><MapPin className="size-4" /></span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2"><strong className="truncate text-[14px] text-[var(--ink)]">{place.name}</strong><span className="shrink-0 text-[10px] text-[var(--faint)]">{category}</span></span>
        <span className="mt-1 block truncate text-[11px] text-[var(--sub)]">{place.roadAddress || place.address}</span>
        {place.distanceM !== null && <span className="mt-1 block text-[10px] font-bold text-[var(--brand-deep)]">{formatDistance(place.distanceM)}</span>}
      </span>
    </button>
  );
}

function FacilityResultRow({ facility, selected, onSelect }: {
  facility: Facility;
  selected: boolean;
  onSelect: (facility: Facility) => void;
}) {
  const category = getPrimaryCategory(facility);
  return (
    <article className={cn("border-b border-[var(--line-soft)] transition", selected && "bg-[var(--brand-pale)]")}>
      <button type="button" onClick={() => onSelect(facility)} className="flex w-full items-start gap-3 px-4 py-3.5 text-left hover:bg-[#f7faf8]">
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg" style={{ color: category.color, backgroundColor: category.softColor }}><CategoryIcon categoryId={category.id} className="size-4" /></span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-extrabold text-[var(--ink)]">{facility.name}</span>
          <span className="mt-1 block truncate text-[11px] text-[var(--sub)]">{facility.address}</span>
          <span className="mt-1.5 flex items-center gap-2 text-[10px]"><span className="font-bold" style={{ color: category.color }}>{category.shortLabel}</span><span className="text-[var(--faint)]">{formatDistance(facility.distanceM)}</span></span>
        </span>
      </button>
      {selected && <Link href={`/facility/${facility.id}`} className="mx-4 mb-3 flex h-8 items-center justify-center gap-1 rounded-lg border border-[var(--line)] bg-white text-[10px] font-extrabold text-[var(--brand-deep)]">상세 정보 <ChevronRight className="size-3.5" /></Link>}
    </article>
  );
}

export function MapWorkspace() {
  const mapRef = useRef<KakaoMapHandle>(null);
  const selectedCategoryId = useAppStore((state) => state.selectedCategoryId);
  const setSelectedCategoryId = useAppStore((state) => state.setSelectedCategoryId);
  const selectedFacilityId = useAppStore((state) => state.selectedFacilityId);
  const setSelectedFacilityId = useAppStore((state) => state.setSelectedFacilityId);
  const [searchValue, setSearchValue] = useState("");
  const [hasPlaceSearch, setHasPlaceSearch] = useState(false);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [viewport, setViewport] = useState<MapViewport | null>(null);
  const [userLocation, setUserLocation] = useState<MapPoint | null>(null);
  const [visibleFacilityCount, setVisibleFacilityCount] = useState(200);

  const facilitiesQuery = useQuery({
    queryKey: ["facilities", selectedCategoryId, viewport, userLocation],
    queryFn: () => fetchFacilities({
      categoryId: selectedCategoryId,
      ...(viewport ?? {}),
      ...(userLocation ? { latitude: userLocation.latitude, longitude: userLocation.longitude } : {}),
    }),
    enabled: viewport !== null,
  });
  const placeSearch = useMutation({
    mutationFn: (query: string) => searchPlaces(query, userLocation),
  });
  const facilities = useMemo(() => facilitiesQuery.data ?? [], [facilitiesQuery.data]);
  const places = useMemo(() => placeSearch.data ?? [], [placeSearch.data]);
  const selectedFacility = useMemo(
    () => facilities.find((facility) => facility.id === selectedFacilityId) ?? null,
    [facilities, selectedFacilityId],
  );
  const visibleFacilities = useMemo(
    () => facilities.slice(0, visibleFacilityCount),
    [facilities, visibleFacilityCount],
  );
  const selectedPlace = useMemo(
    () => places.find((place) => place.id === selectedPlaceId) ?? null,
    [places, selectedPlaceId],
  );
  const focusedPlace = useMemo<MapFocusPoint | null>(() => selectedPlace ? {
    latitude: selectedPlace.coordinates.latitude,
    longitude: selectedPlace.coordinates.longitude,
    title: selectedPlace.name,
  } : null, [selectedPlace]);

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
    if (query.length < 2) return;
    setHasPlaceSearch(true);
    setSelectedPlaceId(null);
    placeSearch.mutate(query);
  }

  function clearSearch() {
    setSearchValue("");
    setHasPlaceSearch(false);
    setSelectedPlaceId(null);
    placeSearch.reset();
  }

  function handlePlaceSelect(place: PlaceSearchResult) {
    setSelectedPlaceId(place.id);
    setSelectedFacilityId(null);
    mapRef.current?.moveTo(place.coordinates, 3);
  }

  function handleFacilitySelect(facility: Facility) {
    setSelectedFacilityId(facility.id);
    setSelectedPlaceId(null);
    mapRef.current?.moveTo(facility.coordinates, 4);
  }

  const desktopList = hasPlaceSearch ? (
    <>
      {placeSearch.isPending && Array.from({ length: 6 }, (_, index) => <div key={index} className="mx-4 my-3 h-[66px] animate-pulse rounded-xl bg-[#f0f3f1]" />)}
      {placeSearch.isError && <div className="px-5 py-12 text-center"><TriangleAlert className="mx-auto size-5 text-rose-500" /><p className="mt-2 text-[12px] font-bold text-rose-700">장소 검색 결과를 불러오지 못했습니다.</p></div>}
      {!placeSearch.isPending && !placeSearch.isError && places.map((place) => <PlaceResultRow key={place.id} place={place} selected={place.id === selectedPlaceId} onSelect={handlePlaceSelect} />)}
      {!placeSearch.isPending && !placeSearch.isError && places.length === 0 && <p className="px-5 py-14 text-center text-[12px] text-[var(--sub)]">검색 결과가 없습니다.</p>}
    </>
  ) : (
    <>
      {facilitiesQuery.isPending && Array.from({ length: 6 }, (_, index) => <div key={index} className="mx-4 my-3 h-[66px] animate-pulse rounded-xl bg-[#f0f3f1]" />)}
      {facilitiesQuery.isError && <div className="px-5 py-12 text-center"><TriangleAlert className="mx-auto size-5 text-rose-500" /><p className="mt-2 text-[12px] font-bold text-rose-700">시설 데이터를 불러오지 못했습니다.</p><button type="button" onClick={() => facilitiesQuery.refetch()} className="mt-3 rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[10px] font-extrabold">다시 시도</button></div>}
      {!facilitiesQuery.isPending && !facilitiesQuery.isError && visibleFacilities.map((facility) => <FacilityResultRow key={facility.id} facility={facility} selected={facility.id === selectedFacility?.id} onSelect={handleFacilitySelect} />)}
      {!facilitiesQuery.isPending && !facilitiesQuery.isError && facilities.length === 0 && <p className="px-5 py-14 text-center text-[12px] text-[var(--sub)]">이 지역에 등록된 수거함이 없습니다.</p>}
    </>
  );

  return (
    <div className="relative flex h-[calc(100dvh-70px-env(safe-area-inset-bottom))] min-h-[560px] overflow-hidden bg-[#edf0e9] lg:h-[calc(100dvh-68px)] lg:min-h-[640px]">
      <aside className="relative z-30 hidden w-[350px] shrink-0 flex-col border-r border-[var(--line)] bg-white shadow-[8px_0_24px_rgba(25,40,35,0.05)] lg:flex xl:w-[370px]">
        <div className="border-b border-[var(--line-soft)] p-4">
          <PlaceSearchForm value={searchValue} onChange={setSearchValue} onSubmit={handleSearch} onClear={clearSearch} />
          <CategoryChips value={selectedCategoryId} onChange={setSelectedCategoryId} compact className="mt-3" />
        </div>
        <div className="flex h-11 shrink-0 items-center border-b border-[var(--line-soft)] px-4">
          <h1 className="text-[12px] font-extrabold text-[var(--ink)]">{hasPlaceSearch ? "검색 결과" : "수거함"}</h1>
        </div>
        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto" onScroll={(event) => {
          const element = event.currentTarget;
          if (!hasPlaceSearch && element.scrollTop + element.clientHeight >= element.scrollHeight - 240) {
            setVisibleFacilityCount((count) => Math.min(count + 200, facilities.length));
          }
        }}>{desktopList}</div>
      </aside>

      <section className="relative min-w-0 flex-1" aria-label="수거함 지도">
        <KakaoMap
          ref={mapRef}
          facilities={facilities}
          selectedId={selectedFacility?.id ?? null}
          onSelect={handleFacilitySelect}
          onViewportChange={handleViewportChange}
          onLocationChange={setUserLocation}
          userLocation={userLocation}
          focusedPlace={focusedPlace}
          className="size-full"
        />

        <div className="absolute inset-x-0 top-0 z-40 px-3 pt-[max(12px,env(safe-area-inset-top))] lg:hidden">
          <div className="flex items-center gap-2.5"><BrandMark compact /><PlaceSearchForm value={searchValue} onChange={setSearchValue} onSubmit={handleSearch} onClear={clearSearch} className="min-w-0 flex-1" /></div>
          <CategoryChips value={selectedCategoryId} onChange={setSelectedCategoryId} compact className="mt-2" />
        </div>

        <div className="absolute right-3 top-[116px] z-40 flex flex-col gap-2 lg:right-4 lg:top-4">
          <button type="button" onClick={() => { setSelectedPlaceId(null); mapRef.current?.locate(); }} aria-label="내 위치로 이동" title="내 위치" className={cn("grid size-10 place-items-center rounded-xl bg-white text-[#34413c] shadow-[0_5px_16px_rgba(34,50,44,0.16)] transition hover:text-[var(--brand-deep)]", userLocation && "text-[var(--brand-deep)]")}><LocateFixed className="size-[19px]" /></button>
          <div className="overflow-hidden rounded-xl bg-white shadow-[0_5px_16px_rgba(34,50,44,0.16)]">
            <button type="button" onClick={() => mapRef.current?.zoomIn()} aria-label="지도 확대" className="grid size-10 place-items-center text-[#34413c] hover:bg-[var(--surface-muted)]"><Plus className="size-[18px]" /></button>
            <div className="mx-2 border-t border-[var(--line)]" />
            <button type="button" onClick={() => mapRef.current?.zoomOut()} aria-label="지도 축소" className="grid size-10 place-items-center text-[#34413c] hover:bg-[var(--surface-muted)]"><Minus className="size-[18px]" /></button>
          </div>
          <button type="button" onClick={() => mapRef.current?.toggleMapType()} aria-label="지도 유형 전환" title="지도 유형" className="grid size-10 place-items-center rounded-xl bg-white text-[#34413c] shadow-[0_5px_16px_rgba(34,50,44,0.16)] transition hover:text-[var(--brand-deep)]"><Layers3 className="size-[18px]" /></button>
        </div>

        {hasPlaceSearch ? (
          <div className="absolute inset-x-0 bottom-0 z-40 max-h-[46dvh] overflow-hidden rounded-t-2xl border-t border-[var(--line)] bg-white shadow-[0_-8px_24px_rgba(30,44,39,0.12)] lg:hidden">
            <div className="flex h-10 items-center border-b border-[var(--line-soft)] px-4"><span className="text-[11px] font-extrabold">검색 결과</span></div>
            <div className="no-scrollbar max-h-[calc(46dvh-40px)] overflow-y-auto">{desktopList}</div>
          </div>
        ) : selectedFacility ? (
          <div className="absolute inset-x-3 bottom-3 z-40 lg:hidden"><FacilityCard facility={selectedFacility} compact selected /></div>
        ) : null}
      </section>
    </div>
  );
}
