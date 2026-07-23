"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowUp, Building2, CornerUpLeft, CornerUpRight, Flag, LocateFixed, LoaderCircle, MapPin, Navigation, Radio, RotateCcw, Route, Satellite, TriangleAlert, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FocusEvent } from "react";
import { KakaoMap, type KakaoMapHandle, type MapPoint } from "@/components/map/kakao-map";
import { ApiError, fetchDirections, fetchFacility, searchPlaces } from "@/lib/api";
import { buildNavigationGeometry, calculateNavigationProgress, maneuverKind, type NavigationGeometry, type NavigationProgress } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import type { DirectionsRoute, Facility, PlaceSearchResult } from "@/types/domain";

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

type NavigationStatus = "idle" | "requesting" | "tracking" | "arrived" | "error";

function ManeuverIcon({ instruction, className }: { instruction: string; className?: string }) {
  const kind = maneuverKind(instruction);
  if (kind === "left") return <CornerUpLeft className={className} />;
  if (kind === "right") return <CornerUpRight className={className} />;
  if (kind === "uturn") return <RotateCcw className={className} />;
  if (kind === "arrive") return <Flag className={className} />;
  return <ArrowUp className={className} />;
}

function guidanceDistance(distanceM: number) {
  if (distanceM <= 12) return "지금";
  if (distanceM <= 40) return "곧";
  return `${formatDistance(distanceM)} 앞`;
}

function LiveGuidanceCard({
  route,
  progress,
  status,
  accuracyM,
  offRoute,
  onReroute,
}: {
  route: DirectionsRoute;
  progress: NavigationProgress | null;
  status: NavigationStatus;
  accuracyM?: number;
  offRoute: boolean;
  onReroute: () => void;
}) {
  const activeStep = progress && progress.activeStepIndex >= 0 ? route.steps[progress.activeStepIndex] : null;
  const nextStep = progress && progress.nextStepIndex >= 0 ? route.steps[progress.nextStepIndex] : null;
  const arrived = status === "arrived" || progress?.arrived;
  const instruction = arrived
    ? "목적지에 도착했습니다."
    : activeStep?.instruction ?? (status === "requesting" ? "현재 위치를 확인하고 있습니다." : "경로를 따라 이동하세요.");
  const distanceLabel = arrived
    ? "도착"
    : progress
      ? guidanceDistance(progress.distanceToStepM)
      : "GPS 연결 중";
  const remainingDistanceM = progress?.remainingDistanceM ?? route.distanceM;
  const remainingDurationS = progress?.remainingDurationS ?? route.durationS;

  return (
    <section data-testid="live-guidance" className="mx-4 mb-5 overflow-hidden rounded-2xl border border-[#ccebdd] bg-white shadow-[0_10px_28px_rgba(8,123,85,0.12)] sm:mx-5">
      <div className="bg-[var(--brand)] p-4 text-white" aria-live="polite" aria-atomic="true">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/16 px-2.5 py-1 text-[9px] font-extrabold">
            {status === "requesting" ? <Satellite className="size-3 animate-pulse" /> : <Radio className={cn("size-3", status === "tracking" && "animate-pulse")} />}
            {status === "requesting" ? "위치 권한 확인 중" : arrived ? "안내 완료" : "GPS 실시간 추적 중"}
          </span>
          {accuracyM !== undefined && status === "tracking" && <span className="text-[9px] font-bold text-white/75">정확도 약 {formatDistance(accuracyM)}</span>}
        </div>
        <div className="mt-4 flex items-start gap-3.5">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-white text-[var(--brand-deep)] shadow-sm">
            <ManeuverIcon instruction={instruction} className="size-8" />
          </span>
          <div className="min-w-0 pt-0.5">
            <p className="text-[12px] font-black text-[#d8ffed]">{distanceLabel}</p>
            <h2 className="mt-1 text-[17px] font-black leading-6 tracking-[-0.025em]">{instruction}</h2>
          </div>
        </div>
      </div>

      {offRoute ? (
        <div className="border-t border-amber-100 bg-amber-50 p-3.5">
          <div className="flex gap-2.5">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-extrabold text-amber-900">경로에서 벗어났습니다.</p>
              <p className="mt-0.5 text-[9px] leading-4 text-amber-800">현재 위치를 기준으로 새 경로를 찾을 수 있습니다.</p>
            </div>
            <button type="button" onClick={onReroute} className="shrink-0 rounded-lg bg-amber-600 px-2.5 py-2 text-[9px] font-extrabold text-white">다시 찾기</button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3">
          <div className="min-w-0">
            {nextStep ? <p className="truncate text-[10px] font-bold text-[var(--sub)]"><span className="mr-1 text-[var(--faint)]">다음</span>{nextStep.instruction}</p> : <p className="text-[10px] font-bold text-[var(--sub)]">목적지까지 경로를 따라 이동하세요.</p>}
          </div>
          <div className="flex items-center gap-2 text-[9px] font-extrabold text-[var(--brand-deep)]">
            <span>{formatDuration(remainingDurationS)}</span><span className="text-[var(--line)]">·</span><span>{formatDistance(remainingDistanceM)}</span>
          </div>
        </div>
      )}
    </section>
  );
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
  const [navigationStatus, setNavigationStatus] = useState<NavigationStatus>("idle");
  const [navigationError, setNavigationError] = useState("");
  const [liveLocation, setLiveLocation] = useState<MapPoint | null>(null);
  const [storedNavigationProgress, setNavigationProgress] = useState<{ route: DirectionsRoute; progress: NavigationProgress } | null>(null);
  const mapRef = useRef<KakaoMapHandle>(null);
  const locationGenerationRef = useRef(0);
  const navigationGenerationRef = useRef(0);
  const locationWatchRef = useRef<number | null>(null);
  const locationFixRef = useRef(false);
  const lastLocationTimestampRef = useRef(0);
  const liveLocationRef = useRef<MapPoint | null>(null);
  const navigationStatusRef = useRef<NavigationStatus>("idle");
  const routeRef = useRef<DirectionsRoute | null>(null);
  const geometryRef = useRef<NavigationGeometry | null>(null);
  const progressRef = useRef({ routeProgressM: 0, segmentIndex: 0 });
  const activeRouteQuery = useQuery({
    queryKey: ["directions-active", routeRequest?.origin.latitude, routeRequest?.origin.longitude, routeRequest?.destination.latitude, routeRequest?.destination.longitude],
    queryFn: ({ signal }) => fetchDirections(routeRequest!.origin, routeRequest!.destination, signal),
    enabled: Boolean(routeRequest),
    retry: false,
    staleTime: 60_000,
  });
  const route = activeRouteQuery.data;
  const navigationGeometry = useMemo(() => route ? buildNavigationGeometry(route) : null, [route]);
  const navigationProgress = storedNavigationProgress && storedNavigationProgress.route === route ? storedNavigationProgress.progress : null;

  useEffect(() => {
    routeRef.current = route ?? null;
    geometryRef.current = navigationGeometry;
    progressRef.current = { routeProgressM: 0, segmentIndex: 0 };
    const point = liveLocationRef.current;
    if (!route || !navigationGeometry || !point || navigationStatusRef.current !== "tracking") return;
    const timer = window.setTimeout(() => {
      if (routeRef.current !== route || geometryRef.current !== navigationGeometry) return;
      const progress = calculateNavigationProgress(route, navigationGeometry, point);
      progressRef.current = { routeProgressM: progress.routeProgressM, segmentIndex: progress.segmentIndex };
      setNavigationProgress({ route, progress });
      if (progress.arrived) {
        navigationGenerationRef.current += 1;
        stopLocationTracking();
        setNavigationMode("arrived");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [navigationGeometry, route]);

  useEffect(() => () => {
    locationGenerationRef.current += 1;
    navigationGenerationRef.current += 1;
    if (locationWatchRef.current !== null) navigator.geolocation?.clearWatch(locationWatchRef.current);
  }, []);

  function setNavigationMode(status: NavigationStatus) {
    navigationStatusRef.current = status;
    setNavigationStatus(status);
  }

  function stopLocationTracking() {
    if (locationWatchRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(locationWatchRef.current);
      locationWatchRef.current = null;
    }
  }

  function resetNavigation(clearPosition = true) {
    navigationGenerationRef.current += 1;
    stopLocationTracking();
    locationFixRef.current = false;
    lastLocationTimestampRef.current = 0;
    progressRef.current = { routeProgressM: 0, segmentIndex: 0 };
    setNavigationMode("idle");
    setNavigationError("");
    setNavigationProgress(null);
    if (clearPosition) {
      liveLocationRef.current = null;
      setLiveLocation(null);
    }
  }

  function clearRoute() {
    resetNavigation();
    routeRef.current = null;
    geometryRef.current = null;
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
    resetNavigation();
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

  function updateNavigationPosition(position: GeolocationPosition, generation: number) {
    if (generation !== navigationGenerationRef.current) return;
    const { latitude, longitude } = position.coords;
    if (![latitude, longitude].every(Number.isFinite) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return;
    const timestamp = Number.isFinite(position.timestamp) ? position.timestamp : Date.now();
    if (timestamp + 1000 < lastLocationTimestampRef.current) return;
    lastLocationTimestampRef.current = timestamp;
    const accuracy = Number.isFinite(position.coords.accuracy) && position.coords.accuracy >= 0
      ? position.coords.accuracy
      : undefined;
    const point: MapPoint = {
      latitude,
      longitude,
      ...(accuracy !== undefined ? { accuracy } : {}),
    };
    locationFixRef.current = true;
    liveLocationRef.current = point;
    setLiveLocation(point);
    setNavigationError("");
    setNavigationMode("tracking");
    mapRef.current?.moveTo(point, 4);

    const currentRoute = routeRef.current;
    const currentGeometry = geometryRef.current;
    if (!currentRoute || !currentGeometry) return;
    const previous = progressRef.current;
    const progress = calculateNavigationProgress(
      currentRoute,
      currentGeometry,
      point,
      previous.routeProgressM,
      previous.segmentIndex,
    );
    progressRef.current = { routeProgressM: progress.routeProgressM, segmentIndex: progress.segmentIndex };
    setNavigationProgress({ route: currentRoute, progress });
    if (progress.arrived) {
      navigationGenerationRef.current += 1;
      stopLocationTracking();
      setNavigationMode("arrived");
    }
  }

  function startNavigation() {
    if (!routeRef.current || !geometryRef.current) return;
    if (!window.isSecureContext && !["localhost", "127.0.0.1"].includes(window.location.hostname)) {
      setNavigationError("안전한 연결에서만 실시간 위치 안내를 사용할 수 있습니다.");
      setNavigationMode("error");
      return;
    }
    if (!navigator.geolocation) {
      setNavigationError("이 기기에서는 실시간 위치 안내를 사용할 수 없습니다.");
      setNavigationMode("error");
      return;
    }

    locationGenerationRef.current += 1;
    setLocationPending(false);
    stopLocationTracking();
    const generation = ++navigationGenerationRef.current;
    locationFixRef.current = false;
    lastLocationTimestampRef.current = 0;
    progressRef.current = { routeProgressM: 0, segmentIndex: 0 };
    setNavigationProgress(null);
    setNavigationError("");
    setNavigationMode("requesting");

    try {
      locationWatchRef.current = navigator.geolocation.watchPosition(
        (position) => updateNavigationPosition(position, generation),
        (error) => {
          if (generation !== navigationGenerationRef.current) return;
          if (error.code !== error.PERMISSION_DENIED && locationFixRef.current) {
            setNavigationError("GPS 신호가 잠시 약합니다. 위치 신호를 기다리고 있습니다.");
            return;
          }
          navigationGenerationRef.current += 1;
          stopLocationTracking();
          setNavigationError(error.code === error.PERMISSION_DENIED
            ? "실시간 안내를 시작하려면 브라우저의 위치 권한을 허용해 주세요."
            : error.code === error.TIMEOUT
              ? "현재 위치 확인 시간이 초과되었습니다. 다시 시도해 주세요."
              : "현재 위치를 확인할 수 없습니다. GPS 설정을 확인해 주세요.");
          setNavigationMode("error");
        },
        { enableHighAccuracy: true, timeout: 15_000, maximumAge: 1000 },
      );
    } catch {
      if (generation !== navigationGenerationRef.current) return;
      navigationGenerationRef.current += 1;
      stopLocationTracking();
      setNavigationError("현재 위치를 확인할 수 없습니다. GPS 설정을 확인해 주세요.");
      setNavigationMode("error");
    }
  }

  function finishNavigation() {
    resetNavigation();
  }

  function rerouteFromCurrentLocation() {
    const point = liveLocationRef.current;
    if (!point || !destination) return;
    const currentOrigin: RoutePoint = {
      id: "current-location",
      name: "현재 위치",
      address: "기기 위치",
      latitude: point.latitude,
      longitude: point.longitude,
    };
    progressRef.current = { routeProgressM: 0, segmentIndex: 0 };
    routeRef.current = null;
    geometryRef.current = null;
    setNavigationProgress(null);
    setOrigin(currentOrigin);
    setOriginValue(currentOrigin.name);
    setRouteRequest({ origin: currentOrigin, destination });
  }

  const originalFacilitySelected = Boolean(facility && destination?.facilityId === facility.id);
  const mapFacilities = originalFacilitySelected && facility ? [facility] : [];
  const focusedPlace = destination && !originalFacilitySelected ? { latitude: destination.latitude, longitude: destination.longitude, title: destination.name } : null;
  const canSearch = Boolean(origin && destination);
  const routeError = activeRouteQuery.error instanceof ApiError ? activeRouteQuery.error.message : "경로를 불러오지 못했습니다.";
  const navigationVisible = navigationStatus === "requesting" || navigationStatus === "tracking" || navigationStatus === "arrived";
  const accuracyM = liveLocation?.accuracy;
  const offRoute = navigationStatus === "tracking"
    && Boolean(navigationProgress && navigationProgress.offRouteDistanceM > Math.max(70, (accuracyM ?? 0) * 1.5));
  const activeStep = navigationProgress && navigationProgress.activeStepIndex >= 0 && route
    ? route.steps[navigationProgress.activeStepIndex]
    : null;
  const mapInstruction = navigationStatus === "arrived"
    ? "목적지에 도착했습니다."
    : activeStep?.instruction ?? (navigationStatus === "requesting" ? "현재 위치를 확인하고 있습니다." : "경로를 따라 이동하세요.");
  const mapDistance = navigationStatus === "arrived"
    ? "도착"
    : navigationProgress
      ? guidanceDistance(navigationProgress.distanceToStepM)
      : "GPS 연결 중";
  const mapUserLocation = liveLocation ?? (origin ? { latitude: origin.latitude, longitude: origin.longitude } : null);
  const buttonText = navigationStatus === "tracking"
    ? "실시간 안내 종료"
    : navigationStatus === "requesting"
      ? "위치 확인 취소"
      : navigationStatus === "arrived"
        ? "안내 닫기"
        : route
          ? "실시간 안내 시작"
          : !destination
            ? "목적지를 선택해 주세요"
            : !origin
              ? "출발지를 선택해 주세요"
              : activeRouteQuery.isFetching
                ? "경로 계산 중"
                : "경로 찾기";
  const primaryDisabled = !navigationVisible && !route && (!canSearch || activeRouteQuery.isFetching);

  function handlePrimaryAction() {
    if (navigationVisible) {
      finishNavigation();
      return;
    }
    if (route) {
      startNavigation();
      return;
    }
    requestRoute();
  }

  return (
    <div className="flex min-h-dvh flex-col bg-white lg:flex-row">
      <aside className="relative z-30 order-2 flex flex-1 flex-col overflow-hidden bg-white lg:order-1 lg:w-[390px] lg:flex-none lg:border-r lg:border-[var(--line)]">
        <header className="flex shrink-0 items-center gap-3 border-b border-[var(--line)] px-4 py-4 sm:px-5">
          <Link href={backHref} aria-label="길찾기 닫기" className="grid size-9 place-items-center rounded-full bg-[var(--surface-muted)]"><ArrowLeft className="size-4.5" /></Link>
          <div><p className="text-[10px] font-bold text-[var(--brand-deep)]">{navigationVisible ? "실시간 안내" : "길찾기"}</p><h1 className="text-[15px] font-extrabold">{navigationVisible ? destination?.name ?? "목적지로 이동 중" : "출발지와 목적지 설정"}</h1></div>
        </header>

        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
          {!navigationVisible && (
            <div className="space-y-3 p-4 sm:p-5">
              <RouteField label="출발지" value={originValue} point={origin} onValueChange={updateOriginValue} onSelect={(point) => { locationGenerationRef.current += 1; setLocationPending(false); setOrigin(point); setOriginValue(point.name); setLocationError(""); clearRoute(); }} onUseLocation={useCurrentLocation} locationPending={locationPending} />
              <RouteField label="목적지" value={destinationValue} point={destination} onValueChange={updateDestinationValue} onSelect={(point) => { setDestination(point); setDestinationValue(point.name); clearRoute(); }} />
              {locationError && <p role="alert" className="text-[10px] font-semibold text-rose-600">{locationError}</p>}
            </div>
          )}

          {destination && (
            <section className={cn("mx-4 py-4 sm:mx-5", !navigationVisible && "border-t border-[var(--line-soft)]")}>
              <div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand-deep)]">{destination.facilityId ? <Navigation className="size-4" /> : <Building2 className="size-4" />}</span><div className="min-w-0"><p className="truncate text-[12px] font-extrabold text-[var(--ink)]">{destination.name}</p><p className="mt-1 text-[10px] leading-4 text-[var(--sub)]">{destination.address}</p></div></div>
            </section>
          )}

          {routeRequest && activeRouteQuery.isPending && <div className="mx-4 mb-4 rounded-xl border border-[var(--line)] bg-[#f8faf9] p-5 text-center sm:mx-5"><LoaderCircle className="mx-auto size-5 animate-spin text-[var(--brand)]" /><p className="mt-2 text-[11px] font-bold text-[var(--sub)]">{navigationStatus === "tracking" ? "현재 위치에서 새 경로를 찾고 있습니다." : "도로 경로를 계산하고 있습니다."}</p></div>}

          {routeRequest && activeRouteQuery.isError && <div className="mx-4 mb-4 rounded-xl border border-rose-100 bg-rose-50 p-4 sm:mx-5"><div className="flex gap-2"><TriangleAlert className="mt-0.5 size-4 shrink-0 text-rose-500" /><p className="text-[11px] font-semibold leading-5 text-rose-700">{routeError}</p></div></div>}

          {navigationError && <div className="mx-4 mb-4 rounded-xl border border-rose-100 bg-rose-50 p-4 sm:mx-5"><div className="flex gap-2"><TriangleAlert className="mt-0.5 size-4 shrink-0 text-rose-500" /><p role="alert" className="text-[11px] font-semibold leading-5 text-rose-700">{navigationError}</p></div></div>}

          {route && !navigationVisible && (
            <section className="mx-4 mb-5 overflow-hidden rounded-2xl border border-[var(--line)] sm:mx-5">
              <div className="bg-[#f2faf6] p-4">
                <div className="flex items-center gap-2 text-[10px] font-extrabold text-[var(--brand-deep)]"><Route className="size-4" />자동차 추천 경로</div>
                <div className="mt-3 flex items-end gap-3"><strong className="text-[24px] font-black tracking-[-0.04em] text-[var(--ink)]">{formatDuration(route.durationS)}</strong><span className="pb-1 text-[12px] font-bold text-[var(--sub)]">{formatDistance(route.distanceM)}</span></div>
                {(route.tollFare > 0 || route.taxiFare > 0) && <p className="mt-2 text-[10px] text-[var(--sub)]">{route.tollFare > 0 && `통행료 ${route.tollFare.toLocaleString()}원`}{route.tollFare > 0 && route.taxiFare > 0 && " · "}{route.taxiFare > 0 && `예상 택시비 ${route.taxiFare.toLocaleString()}원`}</p>}
              </div>
              <div className="border-t border-[var(--line-soft)] px-4 py-3.5">
                <p className="flex items-start gap-2 text-[10px] font-semibold leading-4 text-[var(--sub)]"><LocateFixed className="mt-0.5 size-3.5 shrink-0 text-blue-600" />실시간 안내를 시작하면 위치 권한을 요청하고, 이동에 맞춰 다음 안내만 자동으로 보여줍니다.</p>
              </div>
            </section>
          )}

          {route && navigationVisible && <LiveGuidanceCard route={route} progress={navigationProgress} status={navigationStatus} accuracyM={accuracyM} offRoute={offRoute} onReroute={rerouteFromCurrentLocation} />}
        </div>

        <div className="shrink-0 border-t border-[var(--line)] p-4 sm:p-5">
          <button type="button" disabled={primaryDisabled} onClick={handlePrimaryAction} className={cn("flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[12px] font-extrabold text-white disabled:bg-[#b8c2bd]", navigationVisible ? "bg-slate-700" : "bg-[var(--brand)]")}><Navigation className="size-4" />{buttonText}</button>
        </div>
      </aside>

      <section className="relative order-1 h-[42dvh] min-h-[300px] lg:order-2 lg:h-dvh lg:flex-1">
        <KakaoMap ref={mapRef} facilities={mapFacilities} selectedId={originalFacilitySelected && facility ? facility.id : null} onSelect={() => undefined} userLocation={mapUserLocation} focusedPlace={focusedPlace} routePath={route?.points} className="size-full" />
        <Link href={backHref} className="absolute left-4 top-[max(14px,env(safe-area-inset-top))] z-40 grid size-11 place-items-center rounded-full bg-white text-[var(--ink)] shadow-lg lg:hidden" aria-label="뒤로 가기"><ArrowLeft className="size-5" /></Link>
        {route && navigationVisible && (
          <div data-testid="map-guidance-banner" className="absolute left-4 right-4 top-[72px] z-30 flex items-center gap-3 rounded-2xl bg-[var(--brand)] p-3.5 text-white shadow-[0_12px_32px_rgba(6,69,49,0.28)] lg:top-4 lg:max-w-xl">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white text-[var(--brand-deep)]"><ManeuverIcon instruction={mapInstruction} className="size-6" /></span>
            <div className="min-w-0" aria-hidden="true"><p className="text-[9px] font-black text-[#d8ffed]">{mapDistance}</p><p className="mt-0.5 truncate text-[13px] font-extrabold">{mapInstruction}</p></div>
          </div>
        )}
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
