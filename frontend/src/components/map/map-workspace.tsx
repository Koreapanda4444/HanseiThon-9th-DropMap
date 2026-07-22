"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Building2,
  ChevronRight,
  ExternalLink,
  Layers3,
  LoaderCircle,
  LocateFixed,
  MapPin,
  Minus,
  Navigation,
  Phone,
  Plus,
  Search,
  TriangleAlert,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type FocusEvent, type FormEvent } from "react";
import { CategoryChips } from "@/components/map/category-chips";
import { KakaoMap, type KakaoMapHandle, type MapFocusPoint, type MapPoint, type MapViewport } from "@/components/map/kakao-map";
import { BrandMark } from "@/components/ui/brand-mark";
import { CategoryIcon } from "@/components/ui/category-icon";
import { getPrimaryCategory } from "@/config/facility-categories";
import { fetchFacilities, fetchFacilityClusters, fetchPlaceImage, searchPlaces } from "@/lib/api";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { cn, formatDistance } from "@/lib/utils";
import { useAppStore } from "@/store/use-app-store";
import type { Facility, PlaceSearchResult } from "@/types/domain";

const AGGREGATE_ZOOM_LEVEL = 5;

function PlaceSearchForm({ value, onChange, onSubmit, onClear, suggestions, suggestionsPending, suggestionsOpen, onOpenChange, onSelectSuggestion, className }: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClear: () => void;
  suggestions: PlaceSearchResult[];
  suggestionsPending: boolean;
  suggestionsOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectSuggestion: (place: PlaceSearchResult) => void;
  className?: string;
}) {
  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget)) onOpenChange(false);
  }

  return (
    <div className={cn("relative", className)} onFocusCapture={() => onOpenChange(true)} onBlurCapture={handleBlur}>
      <form onSubmit={onSubmit} className="flex h-11 items-center rounded-xl border border-[#d8dfdb] bg-white px-3 shadow-[0_4px_14px_rgba(30,45,39,0.08)] transition focus-within:border-[var(--brand)] focus-within:ring-3 focus-within:ring-[var(--brand)]/10">
        <Search className="size-[18px] shrink-0 text-[#66736d]" />
        <input value={value} onChange={(event) => onChange(event.target.value)} maxLength={120} className="h-full min-w-0 flex-1 bg-transparent px-2.5 text-[13px] font-semibold text-[var(--ink)] outline-none placeholder:text-[#98a29d]" placeholder="장소, 건물, 주소 검색" aria-label="장소, 건물, 주소 검색" autoComplete="off" />
        {value && <button type="button" onClick={onClear} aria-label="검색어 지우기" className="grid size-7 shrink-0 place-items-center rounded-full text-[#89948f] hover:bg-[var(--surface-muted)]"><X className="size-3.5" /></button>}
        <button type="submit" disabled={value.trim().length < 2} className="ml-1 h-8 shrink-0 rounded-lg bg-[var(--brand)] px-3 text-[11px] font-extrabold text-white disabled:bg-[#b8c4be]">검색</button>
      </form>
      {suggestionsOpen && value.trim().length >= 2 && (
        <div className="absolute inset-x-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-xl border border-[var(--line)] bg-white shadow-[0_12px_30px_rgba(24,40,34,0.16)]">
          {suggestionsPending && <div className="space-y-2 p-3"><div className="h-10 animate-pulse rounded-lg bg-[#f0f3f1]" /><div className="h-10 animate-pulse rounded-lg bg-[#f0f3f1]" /></div>}
          {!suggestionsPending && suggestions.map((place) => (
            <button key={place.id} type="button" onClick={() => onSelectSuggestion(place)} className="flex w-full items-start gap-2.5 border-b border-[var(--line-soft)] px-3 py-2.5 text-left last:border-b-0 hover:bg-[#f7faf8]">
              <MapPin className="mt-0.5 size-4 shrink-0 text-[var(--brand-deep)]" />
              <span className="min-w-0 flex-1"><span className="flex items-baseline gap-2"><strong className="truncate text-[12px] text-[var(--ink)]">{place.name}</strong><span className="shrink-0 text-[9px] text-[var(--faint)]">{place.categoryGroup || "장소"}</span></span><span className="mt-0.5 block truncate text-[10px] text-[var(--sub)]">{place.roadAddress || place.address}</span></span>
            </button>
          ))}
          {!suggestionsPending && suggestions.length === 0 && <p className="px-3 py-4 text-center text-[11px] text-[var(--sub)]">검색 결과가 없습니다.</p>}
        </div>
      )}
    </div>
  );
}

function PlaceResultRow({ place, onSelect }: { place: PlaceSearchResult; onSelect: (place: PlaceSearchResult) => void }) {
  const category = place.categoryGroup || place.category.split(" > ").at(-1) || "장소";
  return (
    <button type="button" onClick={() => onSelect(place)} className="flex w-full items-start gap-3 border-b border-[var(--line-soft)] px-4 py-3.5 text-left transition hover:bg-[#f7faf8]">
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-[#eef2ef] text-[#66736d]"><MapPin className="size-4" /></span>
      <span className="min-w-0 flex-1"><span className="flex items-baseline gap-2"><strong className="truncate text-[14px] text-[var(--ink)]">{place.name}</strong><span className="shrink-0 text-[10px] text-[var(--faint)]">{category}</span></span><span className="mt-1 block truncate text-[11px] text-[var(--sub)]">{place.roadAddress || place.address}</span>{place.distanceM !== null && <span className="mt-1 block text-[10px] font-bold text-[var(--brand-deep)]">{formatDistance(place.distanceM)}</span>}</span>
    </button>
  );
}

function FacilityResultRow({ facility, onSelect }: { facility: Facility; onSelect: (facility: Facility) => void }) {
  const category = getPrimaryCategory(facility);
  return (
    <button type="button" onClick={() => onSelect(facility)} className="flex w-full items-start gap-3 border-b border-[var(--line-soft)] px-4 py-3.5 text-left transition hover:bg-[#f7faf8]">
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg" style={{ color: category.color, backgroundColor: category.softColor }}><CategoryIcon categoryId={category.id} className="size-4" /></span>
      <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-extrabold text-[var(--ink)]">{facility.name}</span><span className="mt-1 block truncate text-[11px] text-[var(--sub)]">{facility.address}</span><span className="mt-1.5 flex items-center gap-2 text-[10px]"><span className="font-bold" style={{ color: category.color }}>{category.shortLabel}</span><span className="text-[var(--faint)]">{formatDistance(facility.distanceM)}</span></span></span>
    </button>
  );
}

function FacilityPreview({ facility, onBack }: { facility: Facility; onBack: () => void }) {
  const category = getPrimaryCategory(facility);
  return (
    <div className="p-4">
      <button type="button" onClick={onBack} className="mb-4 inline-flex items-center gap-1 text-[11px] font-bold text-[var(--sub)]"><ArrowLeft className="size-4" />목록으로</button>
      <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl" style={{ color: category.color, backgroundColor: category.softColor }}><CategoryIcon categoryId={category.id} className="size-5" /></span><div className="min-w-0"><p className="text-[10px] font-bold" style={{ color: category.color }}>{category.label}</p><h2 className="mt-1 text-[17px] font-extrabold leading-6 text-[var(--ink)]">{facility.name}</h2></div></div>
      <p className="mt-4 flex gap-2 text-[11px] leading-5 text-[var(--sub)]"><MapPin className="mt-0.5 size-4 shrink-0" /><span>{facility.address}{facility.detailLocation && <span className="mt-1 block text-[var(--faint)]">{facility.detailLocation}</span>}</span></p>
      <div className="mt-4 grid grid-cols-2 gap-2 border-y border-[var(--line-soft)] py-3"><div><p className="text-[9px] text-[var(--faint)]">상태</p><p className="mt-1 text-[11px] font-bold text-[var(--ink)]">{facility.statusText}</p></div><div><p className="text-[9px] text-[var(--faint)]">거리</p><p className="mt-1 text-[11px] font-bold text-[var(--ink)]">{formatDistance(facility.distanceM)}</p></div></div>
      <div className="mt-4"><p className="text-[10px] font-bold text-[var(--sub)]">수거 품목</p><p className="mt-1.5 text-[11px] leading-5 text-[var(--ink)]">{facility.acceptedItems.slice(0, 6).join(" · ") || "등록된 품목 정보 없음"}</p></div>
      <div className="mt-5 grid grid-cols-2 gap-2"><Link href={`/facility/${facility.id}`} className="flex h-10 items-center justify-center gap-1 rounded-lg border border-[var(--line)] text-[11px] font-extrabold">상세 정보<ChevronRight className="size-3.5" /></Link><Link href={`/directions/${facility.id}`} className="flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[var(--brand)] text-[11px] font-extrabold text-white"><Navigation className="size-3.5" />길찾기</Link></div>
    </div>
  );
}

function placeDirectionsHref(place: PlaceSearchResult) {
  const params = new URLSearchParams({
    name: place.name,
    latitude: String(place.coordinates.latitude),
    longitude: String(place.coordinates.longitude),
    address: place.roadAddress || place.address,
  });
  return `/directions?${params.toString()}`;
}

function PlacePreview({ place, onBack }: { place: PlaceSearchResult; onBack: () => void }) {
  const imageQuery = useQuery({
    queryKey: ["place-image", place.id],
    queryFn: ({ signal }) => fetchPlaceImage(`${place.name} ${place.roadAddress || place.address}`, signal),
    staleTime: 30 * 60_000,
    retry: false,
  });
  const category = place.category.split(" > ").at(-1) || place.categoryGroup || "장소";

  return (
    <div>
      {imageQuery.data && <a href={imageQuery.data.sourceUrl || place.placeUrl || "#"} target="_blank" rel="noreferrer" aria-label="장소 이미지 출처 열기" className="block h-36 bg-[#eef2ef] bg-cover bg-center" style={{ backgroundImage: `url(${JSON.stringify(imageQuery.data.thumbnailUrl)})` }} />}
      <div className="p-4">
        <button type="button" onClick={onBack} className="mb-4 inline-flex items-center gap-1 text-[11px] font-bold text-[var(--sub)]"><ArrowLeft className="size-4" />검색 결과로</button>
        <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#eef2f6] text-[#475569]"><Building2 className="size-5" /></span><div className="min-w-0"><p className="text-[10px] font-bold text-[var(--sub)]">{category}</p><h2 className="mt-1 text-[17px] font-extrabold leading-6 text-[var(--ink)]">{place.name}</h2></div></div>
        <p className="mt-4 flex gap-2 text-[11px] leading-5 text-[var(--sub)]"><MapPin className="mt-0.5 size-4 shrink-0" />{place.roadAddress || place.address}</p>
        {place.phone && <a href={`tel:${place.phone}`} className="mt-2 flex items-center gap-2 text-[11px] text-[var(--sub)]"><Phone className="size-4" />{place.phone}</a>}
        <div className="mt-5 grid grid-cols-2 gap-2">{place.placeUrl ? <a href={place.placeUrl} target="_blank" rel="noreferrer" className="flex h-10 items-center justify-center gap-1 rounded-lg border border-[var(--line)] text-[11px] font-extrabold">장소 보기<ExternalLink className="size-3.5" /></a> : <span />}<Link href={placeDirectionsHref(place)} className="flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[var(--brand)] text-[11px] font-extrabold text-white"><Navigation className="size-3.5" />길찾기</Link></div>
        {imageQuery.data?.sourceName && <p className="mt-2 text-right text-[9px] text-[var(--faint)]">이미지 출처 {imageQuery.data.sourceName}</p>}
      </div>
    </div>
  );
}

export function MapWorkspace() {
  const mapRef = useRef<KakaoMapHandle>(null);
  const selectedCategoryId = useAppStore((state) => state.selectedCategoryId);
  const setSelectedCategoryId = useAppStore((state) => state.setSelectedCategoryId);
  const selectedFacilityId = useAppStore((state) => state.selectedFacilityId);
  const setSelectedFacilityId = useAppStore((state) => state.setSelectedFacilityId);
  const [searchValue, setSearchValue] = useState("");
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [hasPlaceSearch, setHasPlaceSearch] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<PlaceSearchResult | null>(null);
  const [viewport, setViewport] = useState<MapViewport | null>(null);
  const [userLocation, setUserLocation] = useState<MapPoint | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [visibleFacilityCount, setVisibleFacilityCount] = useState(160);
  const lastViewportRef = useRef<MapViewport | null>(null);
  const locationErrorTimerRef = useRef<number | null>(null);
  const aggregateMode = viewport !== null && viewport.level >= AGGREGATE_ZOOM_LEVEL;
  const clusterColumns = viewport ? Math.min(18, Math.max(5, Math.floor(viewport.width / 88))) : 12;
  const clusterRows = viewport ? Math.min(14, Math.max(5, Math.floor(viewport.height / 88))) : 10;
  const distanceLocation = useMemo(() => userLocation ? {
    latitude: Number(userLocation.latitude.toFixed(4)),
    longitude: Number(userLocation.longitude.toFixed(4)),
  } : null, [userLocation]);

  const debouncedSearch = useDebouncedValue(searchValue.trim(), 220);
  const suggestionsReady = debouncedSearch === searchValue.trim();

  useEffect(() => () => {
    if (locationErrorTimerRef.current !== null) window.clearTimeout(locationErrorTimerRef.current);
  }, []);

  const facilitiesQuery = useQuery({
    queryKey: ["facilities", selectedCategoryId, viewport?.west, viewport?.south, viewport?.east, viewport?.north, distanceLocation?.latitude, distanceLocation?.longitude],
    queryFn: ({ signal }) => fetchFacilities({
      categoryId: selectedCategoryId,
      ...(viewport ? { west: viewport.west, south: viewport.south, east: viewport.east, north: viewport.north } : {}),
      ...(distanceLocation ?? {}),
    }, signal),
    enabled: viewport !== null && !aggregateMode,
    placeholderData: (previous) => previous,
    staleTime: 15_000,
  });
  const clustersQuery = useQuery({
    queryKey: ["facility-clusters", selectedCategoryId, viewport?.west, viewport?.south, viewport?.east, viewport?.north, clusterColumns, clusterRows],
    queryFn: ({ signal }) => fetchFacilityClusters({
      categoryId: selectedCategoryId,
      west: viewport?.west ?? 0,
      south: viewport?.south ?? 0,
      east: viewport?.east ?? 0,
      north: viewport?.north ?? 0,
      columns: clusterColumns,
      rows: clusterRows,
    }, signal),
    enabled: aggregateMode,
    placeholderData: (previous) => previous,
    staleTime: 15_000,
  });
  const suggestionsQuery = useQuery({
    queryKey: ["place-suggestions", debouncedSearch, userLocation],
    queryFn: ({ signal }) => searchPlaces(debouncedSearch, userLocation, 3, signal),
    enabled: suggestionsOpen && debouncedSearch.length >= 2,
    staleTime: 30_000,
  });
  const placeSearch = useMutation({ mutationFn: (query: string) => searchPlaces(query, userLocation, 15) });
  const facilities = useMemo(() => aggregateMode
    ? clustersQuery.data === undefined ? facilitiesQuery.data ?? [] : []
    : facilitiesQuery.data ?? [], [aggregateMode, clustersQuery.data, facilitiesQuery.data]);
  const clusters = useMemo(() => aggregateMode
    ? clustersQuery.data ?? []
    : facilitiesQuery.data === undefined ? clustersQuery.data ?? [] : [], [aggregateMode, clustersQuery.data, facilitiesQuery.data]);
  const places = useMemo(() => placeSearch.data ?? [], [placeSearch.data]);
  const selectedFacility = useMemo(() => facilities.find((facility) => facility.id === selectedFacilityId) ?? null, [facilities, selectedFacilityId]);
  const visibleFacilities = useMemo(() => facilities.slice(0, visibleFacilityCount), [facilities, visibleFacilityCount]);
  const focusedPlace = useMemo<MapFocusPoint | null>(() => selectedPlace ? { latitude: selectedPlace.coordinates.latitude, longitude: selectedPlace.coordinates.longitude, title: selectedPlace.name } : null, [selectedPlace]);

  const handleViewportChange = useCallback((nextViewport: MapViewport) => {
    const current = lastViewportRef.current;
    if (current && current.west === nextViewport.west && current.south === nextViewport.south && current.east === nextViewport.east && current.north === nextViewport.north && current.level === nextViewport.level && current.width === nextViewport.width && current.height === nextViewport.height) return;
    lastViewportRef.current = nextViewport;
    setVisibleFacilityCount(160);
    setViewport(nextViewport);
  }, []);

  function handleSearchValueChange(value: string) {
    setSearchValue(value);
    setHasPlaceSearch(false);
    setSelectedPlace(null);
    setSelectedFacilityId(null);
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = searchValue.trim();
    if (query.length < 2) return;
    setHasPlaceSearch(true);
    setSuggestionsOpen(false);
    setSelectedPlace(null);
    setSelectedFacilityId(null);
    placeSearch.mutate(query);
  }

  function clearSearch() {
    setSearchValue("");
    setHasPlaceSearch(false);
    setSelectedPlace(null);
    setSuggestionsOpen(false);
    placeSearch.reset();
  }

  function handlePlaceSelect(place: PlaceSearchResult) {
    setSelectedPlace(place);
    setSelectedFacilityId(null);
    setHasPlaceSearch(true);
    setSuggestionsOpen(false);
    setSearchValue(place.name);
    mapRef.current?.moveTo(place.coordinates, 3);
  }

  function handleFacilitySelect(facility: Facility) {
    setSelectedFacilityId(facility.id);
    setSelectedPlace(null);
    setHasPlaceSearch(false);
    mapRef.current?.moveTo(facility.coordinates, 4);
  }

  async function handleLocate() {
    if (locating) return;
    setSelectedPlace(null);
    setSelectedFacilityId(null);
    setLocationError(null);
    if (locationErrorTimerRef.current !== null) window.clearTimeout(locationErrorTimerRef.current);
    setLocating(true);
    try {
      const map = mapRef.current;
      if (!map) throw new Error("GEOLOCATION_UNAVAILABLE");
      await map.locate();
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      const message = code === "GEOLOCATION_DENIED"
        ? "브라우저 위치 권한을 허용해 주세요."
        : code === "INSECURE_CONTEXT"
          ? "안전한 연결에서 위치 기능을 사용할 수 있습니다."
          : "현재 위치를 확인할 수 없습니다.";
      setLocationError(message);
      locationErrorTimerRef.current = window.setTimeout(() => {
        setLocationError(null);
        locationErrorTimerRef.current = null;
      }, 3200);
    } finally {
      setLocating(false);
    }
  }

  const searchForm = (className?: string) => <PlaceSearchForm value={searchValue} onChange={handleSearchValueChange} onSubmit={handleSearch} onClear={clearSearch} suggestions={suggestionsReady ? suggestionsQuery.data ?? [] : []} suggestionsPending={searchValue.trim().length >= 2 && (!suggestionsReady || suggestionsQuery.isPending)} suggestionsOpen={suggestionsOpen} onOpenChange={setSuggestionsOpen} onSelectSuggestion={handlePlaceSelect} className={className} />;

  let desktopContent;
  if (selectedFacility) {
    desktopContent = <FacilityPreview facility={selectedFacility} onBack={() => setSelectedFacilityId(null)} />;
  } else if (selectedPlace) {
    desktopContent = <PlacePreview place={selectedPlace} onBack={() => setSelectedPlace(null)} />;
  } else if (hasPlaceSearch) {
    desktopContent = <>{placeSearch.isPending && Array.from({ length: 5 }, (_, index) => <div key={index} className="mx-4 my-3 h-[66px] animate-pulse rounded-xl bg-[#f0f3f1]" />)}{placeSearch.isError && <div className="px-5 py-12 text-center"><TriangleAlert className="mx-auto size-5 text-rose-500" /><p className="mt-2 text-[12px] font-bold text-rose-700">장소 검색 결과를 불러오지 못했습니다.</p></div>}{!placeSearch.isPending && !placeSearch.isError && places.map((place) => <PlaceResultRow key={place.id} place={place} onSelect={handlePlaceSelect} />)}{!placeSearch.isPending && !placeSearch.isError && places.length === 0 && <p className="px-5 py-14 text-center text-[12px] text-[var(--sub)]">검색 결과가 없습니다.</p>}</>;
  } else if (aggregateMode) {
    desktopContent = <div className="px-5 py-14 text-center"><MapPin className="mx-auto size-5 text-[var(--brand-deep)]" /><p className="mt-2 text-[12px] font-bold text-[var(--ink)]">지도를 확대해 수거함을 확인하세요.</p></div>;
  } else {
    desktopContent = <>{facilitiesQuery.isPending && !facilitiesQuery.data && Array.from({ length: 5 }, (_, index) => <div key={index} className="mx-4 my-3 h-[66px] animate-pulse rounded-xl bg-[#f0f3f1]" />)}{facilitiesQuery.isError && <div className="px-5 py-12 text-center"><TriangleAlert className="mx-auto size-5 text-rose-500" /><p className="mt-2 text-[12px] font-bold text-rose-700">시설 데이터를 불러오지 못했습니다.</p><button type="button" onClick={() => facilitiesQuery.refetch()} className="mt-3 rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[10px] font-extrabold">다시 시도</button></div>}{!facilitiesQuery.isError && visibleFacilities.map((facility) => <FacilityResultRow key={facility.id} facility={facility} onSelect={handleFacilitySelect} />)}{!facilitiesQuery.isPending && !facilitiesQuery.isError && facilities.length === 0 && <p className="px-5 py-14 text-center text-[12px] text-[var(--sub)]">이 지역에 등록된 수거함이 없습니다.</p>}</>;
  }

  const mobilePanel = selectedFacility ? <FacilityPreview facility={selectedFacility} onBack={() => setSelectedFacilityId(null)} /> : selectedPlace ? <PlacePreview place={selectedPlace} onBack={() => setSelectedPlace(null)} /> : hasPlaceSearch ? desktopContent : null;

  return (
    <div className="relative flex h-[calc(100dvh-70px-env(safe-area-inset-bottom))] min-h-[560px] overflow-hidden bg-[#edf0e9] lg:h-[calc(100dvh-68px)] lg:min-h-[640px]">
      <aside className="relative z-30 hidden w-[332px] shrink-0 flex-col border-r border-[var(--line)] bg-white shadow-[8px_0_24px_rgba(25,40,35,0.05)] lg:flex xl:w-[352px]">
        <div className="relative z-40 border-b border-[var(--line-soft)] p-3.5">{searchForm()}<CategoryChips value={selectedCategoryId} onChange={(value) => { setSelectedCategoryId(value); setSelectedFacilityId(null); setVisibleFacilityCount(160); }} compact className="mt-3" /></div>
        <div className="flex h-10 shrink-0 items-center border-b border-[var(--line-soft)] px-4"><h1 className="text-[11px] font-extrabold text-[var(--ink)]">{selectedFacility ? "시설 정보" : selectedPlace ? "장소 정보" : hasPlaceSearch ? "검색 결과" : "수거함"}</h1></div>
        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto" onScroll={(event) => { const element = event.currentTarget; if (!hasPlaceSearch && !selectedFacility && element.scrollTop + element.clientHeight >= element.scrollHeight - 240) setVisibleFacilityCount((count) => Math.min(count + 160, facilities.length)); }}>{desktopContent}</div>
      </aside>

      <section className="relative min-w-0 flex-1" aria-label="수거함 지도">
        <KakaoMap ref={mapRef} facilities={facilities} clusters={clusters} selectedId={selectedFacility?.id ?? null} onSelect={handleFacilitySelect} onViewportChange={handleViewportChange} onLocationChange={setUserLocation} userLocation={userLocation} focusedPlace={focusedPlace} className="size-full" />

        <div className="absolute inset-x-0 top-0 z-40 px-3 pt-[max(12px,env(safe-area-inset-top))] lg:hidden"><div className="flex items-center gap-2.5"><BrandMark compact />{searchForm("min-w-0 flex-1")}</div><CategoryChips value={selectedCategoryId} onChange={(value) => { setSelectedCategoryId(value); setSelectedFacilityId(null); setVisibleFacilityCount(160); }} compact className="mt-2" /></div>

        <div className="absolute right-3 top-[116px] z-30 flex flex-col gap-2 lg:right-4 lg:top-4">
          <button type="button" onClick={handleLocate} disabled={locating} aria-label={locating ? "현재 위치 확인 중" : "내 위치로 이동"} title="내 위치" className={cn("grid size-10 place-items-center rounded-xl bg-white text-[#34413c] shadow-[0_5px_16px_rgba(34,50,44,0.16)] transition hover:text-[var(--brand-deep)] disabled:cursor-wait", userLocation && "text-[var(--brand-deep)]")}>
            {locating ? <LoaderCircle className="size-[19px] animate-spin" /> : <LocateFixed className="size-[19px]" />}
          </button>
          <div className="overflow-hidden rounded-xl bg-white shadow-[0_5px_16px_rgba(34,50,44,0.16)]"><button type="button" onClick={() => mapRef.current?.zoomIn()} aria-label="지도 확대" className="grid size-10 place-items-center text-[#34413c] hover:bg-[var(--surface-muted)]"><Plus className="size-[18px]" /></button><div className="mx-2 border-t border-[var(--line)]" /><button type="button" onClick={() => mapRef.current?.zoomOut()} aria-label="지도 축소" className="grid size-10 place-items-center text-[#34413c] hover:bg-[var(--surface-muted)]"><Minus className="size-[18px]" /></button></div>
          <button type="button" onClick={() => mapRef.current?.toggleMapType()} aria-label="지도 유형 전환" title="지도 유형" className="grid size-10 place-items-center rounded-xl bg-white text-[#34413c] shadow-[0_5px_16px_rgba(34,50,44,0.16)] transition hover:text-[var(--brand-deep)]"><Layers3 className="size-[18px]" /></button>
        </div>

        {locationError && <div role="alert" className="absolute right-[60px] top-[116px] z-30 max-w-[calc(100%-84px)] rounded-xl bg-[#28332f] px-3.5 py-2.5 text-[11px] font-bold text-white shadow-[0_6px_18px_rgba(23,33,30,0.22)] lg:right-[64px] lg:top-4">{locationError}</div>}

        {mobilePanel && <div className="absolute inset-x-0 bottom-0 z-40 max-h-[52dvh] overflow-y-auto rounded-t-2xl border-t border-[var(--line)] bg-white shadow-[0_-8px_24px_rgba(30,44,39,0.12)] lg:hidden">{mobilePanel}</div>}
      </section>
    </div>
  );
}
