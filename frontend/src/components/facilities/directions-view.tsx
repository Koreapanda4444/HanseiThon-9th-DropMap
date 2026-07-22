"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Building2, Clock3, LocateFixed, LoaderCircle, MapPin, Navigation, Route, TriangleAlert, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type FocusEvent } from "react";
import { KakaoMap } from "@/components/map/kakao-map";
import { ApiError, fetchDirections, fetchFacility, searchPlaces } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import type { Facility, PlaceSearchResult } from "@/types/domain";

export interface RoutePoint {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  facilityId?: string;
}

interface RouteRequest {
  origin: RoutePoint;
  destination: RoutePoint;
}

function placeToRoutePoint(place: PlaceSearchResult): RoutePoint {
  return {
    id: `place-${place.id}`,
    name: place.name,
    address: place.roadAddress || place.address,
    latitude: place.coordinates.latitude,
    longitude: place.coordinates.longitude,
  };
}

function formatDistance(distanceM: number) {
  if (distanceM < 1000) return `${Math.round(distanceM)}m`;
  return `${(distanceM / 1000).toFixed(distanceM >= 10_000 ? 0 : 1)}km`;
}

function formatDuration(durationS: number) {
  const minutes = Math.max(1, Math.ceil(durationS / 60));
  if (minutes < 60) return `${minutes}분`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}시간 ${remainder}분` : `${hours}시간`;
}

function RouteField({ label, value, point, onValueChange, onSelect, onUseLocation, locationPending }: {
  label: string;
  value: string;
  point: RoutePoint | null;
  onValueChange: (value: string) => void;
  onSelect: (point: RoutePoint) => void;
  onUseLocation?: () => void;
  locationPending?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const deferredValue = useDebouncedValue(value.trim(), 220);
  const resultsReady = deferredValue === value.trim();
  const resultsQuery = useQuery({
    queryKey: ["route-place-search", deferredValue],
    queryFn: ({ signal }) => searchPlaces(deferredValue, null, 3, signal),
    enabled: open && deferredValue.length >= 2 && !point,
    staleTime: 30_000,
  });

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }

  return (
    <div className="relative" onFocusCapture={() => setOpen(true)} onBlurCapture={handleBlur}>
      <label className="block text-[10px] font-bold text-[var(--sub)]">{label}
        <span className={cn("mt-1.5 flex h-11 items-center rounded-xl border bg-white px-3", point ? "border-[var(--brand)]" : "border-[var(--line)] focus-within:border-[var(--brand)]")}>
          {label === "출발지" ? <Navigation className="size-4 shrink-0 text-blue-600" /> : <MapPin className="size-4 shrink-0 text-[var(--brand-deep)]" />}
          <input value={value} onChange={(event) => onValueChange(event.target.value)} maxLength={120} className="h-full min-w-0 flex-1 px-2.5 text-[12px] font-semibold text-[var(--ink)] outline-none" placeholder={`${label} 검색`} autoComplete="off" />
          {value && <button type="button" onClick={() => onValueChange("")} aria-label={`${label} 지우기`} className="grid size-7 place-items-center text-[var(--faint)]"><X className="size-3.5" /></button>}
          {onUseLocation && <button type="button" onClick={onUseLocation} disabled={locationPending} className="ml-1 grid size-8 place-items-center rounded-lg bg-[#edf4ff] text-blue-600 disabled:opacity-50" aria-label="현재 위치를 출발지로 설정">{locationPending ? <LoaderCircle className="size-4 animate-spin" /> : <LocateFixed className="size-4" />}</button>}
        </span>
      </label>
      {open && !point && value.trim().length >= 2 && (
        <div className="absolute inset-x-0 top-[calc(100%+5px)] z-50 overflow-hidden rounded-xl border border-[var(--line)] bg-white shadow-[0_10px_24px_rgba(28,42,36,0.14)]">
          {(!resultsReady || resultsQuery.isPending) && <div className="space-y-2 p-3"><div className="h-10 animate-pulse rounded-lg bg-[#eef2ef]" /><div className="h-10 animate-pulse rounded-lg bg-[#eef2ef]" /></div>}
          {resultsReady && resultsQuery.data?.map((place) => <button key={place.id} type="button" onClick={() => { onSelect(placeToRoutePoint(place)); setOpen(false); }} className="flex w-full items-start gap-2.5 border-b border-[var(--line-soft)] px-3 py-2.5 text-left last:border-b-0 hover:bg-[#f7faf8]"><MapPin className="mt-0.5 size-3.5 shrink-0 text-[var(--brand-deep)]" /><span className="min-w-0"><strong className="block truncate text-[11px] text-[var(--ink)]">{place.name}</strong><span className="mt-0.5 block truncate text-[9px] text-[var(--sub)]">{place.roadAddress || place.address}</span></span></button>)}
          {resultsReady && !resultsQuery.isPending && resultsQuery.data?.length === 0 && <p className="px-3 py-4 text-center text-[10px] text-[var(--sub)]">검색 결과가 없습니다.</p>}
        </div>
      )}
    </div>
  );
}

export function DirectionsPlanner({ initialDestination, backHref, facility }: {
  initialDestination: RoutePoint;
  backHref: string;
  facility?: Facility;
}) {
  const [origin, setOrigin] = useState<RoutePoint | null>(null);
  const [destination, setDestination] = useState<RoutePoint | null>(initialDestination);
  const [originValue, setOriginValue] = useState("");
  const [destinationValue, setDestinationValue] = useState(initialDestination.name);
  const [locationPending, setLocationPending] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [routeRequest, setRouteRequest] = useState<RouteRequest | null>(null);
  const locationGenerationRef = useRef(0);
  const activeRouteQuery = useQuery({
    queryKey: ["directions-active", routeRequest?.origin.latitude, routeRequest?.origin.longitude, routeRequest?.destination.latitude, routeRequest?.destination.longitude],
    queryFn: ({ signal }) => fetchDirections(routeRequest!.origin, routeRequest!.destination, signal),
    enabled: Boolean(routeRequest),
    retry: false,
    staleTime: 60_000,
  });

  useEffect(() => () => {
    locationGenerationRef.current += 1;
  }, []);

  function clearRoute() {
    setRouteRequest(null);
  }

  function updateOriginValue(value: string) {
    locationGenerationRef.current += 1;
    setLocationPending(false);
    setOriginValue(value);
    setOrigin(null);
    setLocationError("");
    clearRoute();
  }

  function updateDestinationValue(value: string) {
    setDestinationValue(value);
    setDestination(null);
    clearRoute();
  }

  function useCurrentLocation() {
    if (!window.isSecureContext && !["localhost", "127.0.0.1"].includes(window.location.hostname)) {
      setLocationError("안전한 연결에서 위치 기능을 사용할 수 있습니다.");
      return;
    }
    if (!navigator.geolocation) {
      setLocationError("현재 위치를 사용할 수 없습니다.");
      return;
    }
    const generation = ++locationGenerationRef.current;
    let settled = false;
    let failures = 0;
    let denied = false;
    setLocationPending(true);
    setLocationError("");
    const succeed = (position: GeolocationPosition) => {
      if (settled || generation !== locationGenerationRef.current) return;
      const { latitude, longitude } = position.coords;
      if (![latitude, longitude].every(Number.isFinite) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
        fail();
        return;
      }
      settled = true;
      const point: RoutePoint = {
        id: "current-location",
        name: "현재 위치",
        address: "기기 위치",
        latitude,
        longitude,
      };
      setOrigin(point);
      setOriginValue(point.name);
      setLocationPending(false);
      clearRoute();
    };
    const fail = (error?: GeolocationPositionError) => {
      if (settled || generation !== locationGenerationRef.current) return;
      failures += 1;
      denied ||= error?.code === error?.PERMISSION_DENIED;
      if (failures < 2) return;
      settled = true;
      setLocationError(denied ? "위치 권한을 확인해 주세요." : "현재 위치를 확인할 수 없습니다.");
      setLocationPending(false);
    };
    try {
      navigator.geolocation.getCurrentPosition(succeed, fail, { enableHighAccuracy: false, timeout: 2500, maximumAge: 60_000 });
    } catch {
      fail();
    }
    try {
      navigator.geolocation.getCurrentPosition(succeed, fail, { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 });
    } catch {
      fail();
    }
  }

  function requestRoute() {
    if (!origin || !destination) return;
    const sameRoute = routeRequest
      && routeRequest.origin.latitude === origin.latitude
      && routeRequest.origin.longitude === origin.longitude
      && routeRequest.destination.latitude === destination.latitude
      && routeRequest.destination.longitude === destination.longitude;
    if (sameRoute) {
      void activeRouteQuery.refetch();
      return;
    }
    setRouteRequest({ origin, destination });
  }

  const originalFacilitySelected = Boolean(facility && destination?.facilityId === facility.id);
  const mapFacilities = originalFacilitySelected && facility ? [facility] : [];
  const focusedPlace = destination && !originalFacilitySelected ? { latitude: destination.latitude, longitude: destination.longitude, title: destination.name } : null;
  const route = activeRouteQuery.data;
  const canSearch = Boolean(origin && destination);
  const routeError = activeRouteQuery.error instanceof ApiError ? activeRouteQuery.error.message : "경로를 불러오지 못했습니다.";
  const buttonText = !destination ? "목적지를 선택해 주세요" : !origin ? "출발지를 선택해 주세요" : activeRouteQuery.isFetching ? "경로 계산 중" : route ? "경로 다시 찾기" : "경로 찾기";

  return (
    <div className="flex min-h-dvh flex-col bg-white lg:flex-row">
      <aside className="relative z-30 order-2 flex flex-1 flex-col overflow-hidden bg-white lg:order-1 lg:w-[390px] lg:flex-none lg:border-r lg:border-[var(--line)]">
        <header className="flex shrink-0 items-center gap-3 border-b border-[var(--line)] px-4 py-4 sm:px-5">
          <Link href={backHref} aria-label="길찾기 닫기" className="grid size-9 place-items-center rounded-full bg-[var(--surface-muted)]"><ArrowLeft className="size-4.5" /></Link>
          <div><p className="text-[10px] font-bold text-[var(--brand-deep)]">길찾기</p><h1 className="text-[15px] font-extrabold">출발지와 목적지 설정</h1></div>
        </header>

        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
          <div className="space-y-3 p-4 sm:p-5">
            <RouteField label="출발지" value={originValue} point={origin} onValueChange={updateOriginValue} onSelect={(point) => { locationGenerationRef.current += 1; setLocationPending(false); setOrigin(point); setOriginValue(point.name); setLocationError(""); clearRoute(); }} onUseLocation={useCurrentLocation} locationPending={locationPending} />
            <RouteField label="목적지" value={destinationValue} point={destination} onValueChange={updateDestinationValue} onSelect={(point) => { setDestination(point); setDestinationValue(point.name); clearRoute(); }} />
            {locationError && <p role="alert" className="text-[10px] font-semibold text-rose-600">{locationError}</p>}
          </div>

          {destination && (
            <section className="mx-4 border-t border-[var(--line-soft)] py-4 sm:mx-5">
              <div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand-deep)]">{destination.facilityId ? <Navigation className="size-4" /> : <Building2 className="size-4" />}</span><div className="min-w-0"><p className="truncate text-[12px] font-extrabold text-[var(--ink)]">{destination.name}</p><p className="mt-1 text-[10px] leading-4 text-[var(--sub)]">{destination.address}</p></div></div>
            </section>
          )}

          {routeRequest && activeRouteQuery.isPending && <div className="mx-4 mb-4 rounded-xl border border-[var(--line)] bg-[#f8faf9] p-5 text-center sm:mx-5"><LoaderCircle className="mx-auto size-5 animate-spin text-[var(--brand)]" /><p className="mt-2 text-[11px] font-bold text-[var(--sub)]">도로 경로를 계산하고 있습니다.</p></div>}

          {routeRequest && activeRouteQuery.isError && <div className="mx-4 mb-4 rounded-xl border border-rose-100 bg-rose-50 p-4 sm:mx-5"><div className="flex gap-2"><TriangleAlert className="mt-0.5 size-4 shrink-0 text-rose-500" /><p className="text-[11px] font-semibold leading-5 text-rose-700">{routeError}</p></div></div>}

          {route && (
            <section className="mx-4 mb-5 overflow-hidden rounded-2xl border border-[var(--line)] sm:mx-5">
              <div className="bg-[#f2faf6] p-4">
                <div className="flex items-center gap-2 text-[10px] font-extrabold text-[var(--brand-deep)]"><Route className="size-4" />자동차 추천 경로</div>
                <div className="mt-3 flex items-end gap-3"><strong className="text-[24px] font-black tracking-[-0.04em] text-[var(--ink)]">{formatDuration(route.durationS)}</strong><span className="pb-1 text-[12px] font-bold text-[var(--sub)]">{formatDistance(route.distanceM)}</span></div>
                {(route.tollFare > 0 || route.taxiFare > 0) && <p className="mt-2 text-[10px] text-[var(--sub)]">{route.tollFare > 0 && `통행료 ${route.tollFare.toLocaleString()}원`}{route.tollFare > 0 && route.taxiFare > 0 && " · "}{route.taxiFare > 0 && `예상 택시비 ${route.taxiFare.toLocaleString()}원`}</p>}
              </div>
              <div className="border-t border-[var(--line-soft)] px-4 py-3"><h2 className="flex items-center gap-1.5 text-[11px] font-extrabold"><Clock3 className="size-3.5 text-[var(--brand)]" />경로 안내</h2></div>
              <ol className="divide-y divide-[var(--line-soft)]">
                {route.steps.map((step, index) => <li key={step.id} className="flex gap-3 px-4 py-3"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-[var(--brand-soft)] text-[9px] font-black text-[var(--brand-deep)]">{index + 1}</span><div className="min-w-0"><p className="text-[11px] font-bold leading-5 text-[var(--ink)]">{step.instruction}</p>{step.distanceM > 0 && <p className="mt-0.5 text-[9px] text-[var(--faint)]">{formatDistance(step.distanceM)}</p>}</div></li>)}
              </ol>
            </section>
          )}
        </div>

        <div className="shrink-0 border-t border-[var(--line)] p-4 sm:p-5">
          <button type="button" disabled={!canSearch || activeRouteQuery.isFetching} onClick={requestRoute} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] text-[12px] font-extrabold text-white disabled:bg-[#b8c2bd]"><Navigation className="size-4" />{buttonText}</button>
        </div>
      </aside>

      <section className="relative order-1 h-[42dvh] min-h-[300px] lg:order-2 lg:h-dvh lg:flex-1">
        <KakaoMap facilities={mapFacilities} selectedId={originalFacilitySelected && facility ? facility.id : null} onSelect={() => undefined} userLocation={origin ? { latitude: origin.latitude, longitude: origin.longitude } : null} focusedPlace={focusedPlace} routePath={route?.points} className="size-full" />
        <Link href={backHref} className="absolute left-4 top-[max(14px,env(safe-area-inset-top))] z-40 grid size-11 place-items-center rounded-full bg-white text-[var(--ink)] shadow-lg lg:hidden" aria-label="뒤로 가기"><ArrowLeft className="size-5" /></Link>
      </section>
    </div>
  );
}

export function DirectionsExperience({ id }: { id: string }) {
  const facilityQuery = useQuery({ queryKey: ["facility", id], queryFn: ({ signal }) => fetchFacility(id, signal), retry: false });

  if (facilityQuery.isPending) return <div className="h-dvh animate-pulse bg-[#eef2ef]" />;
  if (facilityQuery.isError) {
    return <div className="grid h-dvh place-items-center bg-white px-4"><div className="max-w-sm text-center"><TriangleAlert className="mx-auto size-7 text-rose-500" /><h1 className="mt-4 text-[18px] font-black">목적지 정보를 불러오지 못했습니다.</h1><Link href="/" className="mt-5 inline-flex rounded-xl bg-[var(--brand)] px-4 py-2.5 text-[12px] font-extrabold text-white">지도로 돌아가기</Link></div></div>;
  }

  const facility = facilityQuery.data;
  return <DirectionsPlanner facility={facility} backHref={`/facility/${facility.id}`} initialDestination={{ id: `facility-${facility.id}`, facilityId: facility.id, name: facility.name, address: `${facility.address}${facility.detailLocation ? ` ${facility.detailLocation}` : ""}`, latitude: facility.coordinates.latitude, longitude: facility.coordinates.longitude }} />;
}
