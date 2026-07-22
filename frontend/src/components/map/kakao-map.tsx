"use client";

import { LoaderCircle, MapPin } from "lucide-react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { CATEGORY_BY_ID, getPrimaryCategory } from "@/config/facility-categories";
import { cn } from "@/lib/utils";
import type { Facility, FacilityCategoryId, FacilityCluster } from "@/types/domain";

export interface MapPoint {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface MapViewport {
  west: number;
  south: number;
  east: number;
  north: number;
  level: number;
  width: number;
  height: number;
}

export interface MapFocusPoint extends MapPoint {
  title: string;
}

export interface KakaoMapHandle {
  locate: () => Promise<MapPoint>;
  moveTo: (point: MapPoint, level?: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  toggleMapType: () => void;
}

interface KakaoLatLng {
  getLat: () => number;
  getLng: () => number;
}

interface KakaoBounds {
  getSouthWest: () => KakaoLatLng;
  getNorthEast: () => KakaoLatLng;
}

interface KakaoMapInstance {
  relayout: () => void;
  getLevel: () => number;
  setLevel: (level: number, options?: { animate?: boolean | { duration: number } }) => void;
  setBounds: (bounds: KakaoLatLngBounds, paddingTop?: number, paddingRight?: number, paddingBottom?: number, paddingLeft?: number) => void;
  setCenter: (position: KakaoLatLng) => void;
  panTo: (position: KakaoLatLng) => void;
  getBounds: () => KakaoBounds;
  setMapTypeId: (mapTypeId: number) => void;
}

type KakaoMarkerImageInstance = object;
type KakaoSizeInstance = object;
type KakaoPointInstance = object;

interface KakaoMarkerInstance {
  setMap: (map: KakaoMapInstance | null) => void;
  setImage: (image: KakaoMarkerImageInstance) => void;
  setPosition: (position: KakaoLatLng) => void;
  setTitle: (title: string) => void;
}

interface KakaoOverlayInstance {
  setMap: (map: KakaoMapInstance | null) => void;
}

interface KakaoPolylineInstance {
  setMap: (map: KakaoMapInstance | null) => void;
}

interface KakaoCircleInstance {
  setMap: (map: KakaoMapInstance | null) => void;
}

interface KakaoLatLngBounds {
  extend: (position: KakaoLatLng) => void;
}

interface KakaoMapsApi {
  load: (callback: () => void) => void;
  version?: string;
  readyState?: number;
  LatLng: new (latitude: number, longitude: number) => KakaoLatLng;
  Size: new (width: number, height: number) => KakaoSizeInstance;
  Point: new (x: number, y: number) => KakaoPointInstance;
  LatLngBounds: new () => KakaoLatLngBounds;
  Map: new (container: HTMLElement, options: { center: KakaoLatLng; level: number }) => KakaoMapInstance;
  MarkerImage: new (source: string, size: KakaoSizeInstance, options: { offset: KakaoPointInstance }) => KakaoMarkerImageInstance;
  Marker: new (options: { map?: KakaoMapInstance; position: KakaoLatLng; title: string; image?: KakaoMarkerImageInstance }) => KakaoMarkerInstance;
  CustomOverlay: new (options: { map?: KakaoMapInstance; position: KakaoLatLng; content: HTMLElement; xAnchor?: number; yAnchor?: number; zIndex?: number }) => KakaoOverlayInstance;
  Polyline: new (options: { map?: KakaoMapInstance; path: KakaoLatLng[]; strokeWeight: number; strokeColor: string; strokeOpacity: number; strokeStyle: string }) => KakaoPolylineInstance;
  Circle: new (options: { map?: KakaoMapInstance; center: KakaoLatLng; radius: number; strokeWeight: number; strokeColor: string; strokeOpacity: number; fillColor: string; fillOpacity: number }) => KakaoCircleInstance;
  MapTypeId: {
    ROADMAP: number;
    HYBRID: number;
  };
  event: {
    addListener: (target: KakaoMapInstance | KakaoMarkerInstance, event: string, callback: () => void) => void;
    removeListener: (target: KakaoMapInstance | KakaoMarkerInstance, event: string, callback: () => void) => void;
  };
}

declare global {
  interface Window {
    kakao?: { maps: KakaoMapsApi };
  }
}

interface KakaoMapProps {
  facilities: Facility[];
  clusters?: FacilityCluster[];
  selectedId: string | null;
  onSelect: (facility: Facility) => void;
  onViewportChange?: (viewport: MapViewport) => void;
  onLocationChange?: (point: MapPoint) => void;
  userLocation?: MapPoint | null;
  focusedPlace?: MapFocusPoint | null;
  routePath?: MapPoint[];
  className?: string;
}

interface MarkerEntry {
  facility: Facility;
  marker: KakaoMarkerInstance;
  categoryId: FacilityCategoryId;
  clickHandler: () => void;
}

const emptyRoutePath: MapPoint[] = [];
const emptyClusters: FacilityCluster[] = [];
const kakaoSdkId = "kakao-map-sdk";
const kakaoMainSdkId = "kakao-map-main-sdk";
let kakaoSdkPromise: Promise<KakaoMapsApi> | null = null;

function normalizeLocalMapOrigin() {
  if (process.env.NODE_ENV !== "development" || window.location.port !== "3000") return false;
  if (!["127.0.0.1", "0.0.0.0", "[::1]"].includes(window.location.hostname)) return false;
  const url = new URL(window.location.href);
  url.hostname = "localhost";
  window.location.replace(url);
  return true;
}

function loadKakaoMapsSdk(appKey: string) {
  const currentMaps = window.kakao?.maps;
  if (currentMaps && typeof currentMaps.Map === "function") return Promise.resolve(currentMaps);
  if (kakaoSdkPromise) return kakaoSdkPromise;

  const source = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appKey)}&autoload=false`;
  const task = new Promise<KakaoMapsApi>((resolve, reject) => {
    let script = document.getElementById(kakaoSdkId) as HTMLScriptElement | null;
    let mainScript = document.getElementById(kakaoMainSdkId) as HTMLScriptElement | null;
    let timeoutId: number | null = null;
    let settled = false;

    const cleanup = () => {
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      script?.removeEventListener("load", activate);
      script?.removeEventListener("error", handleError);
      mainScript?.removeEventListener("load", handleMainLoad);
      mainScript?.removeEventListener("error", handleMainError);
    };
    const fail = (code: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      script?.remove();
      mainScript?.remove();
      reject(new Error(code));
    };
    const succeed = (maps: KakaoMapsApi) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(maps);
    };
    const handleMainLoad = () => {
      const maps = window.kakao?.maps;
      if (!maps || typeof maps.Map !== "function") {
        fail("KAKAO_MAP_MODULE_UNAVAILABLE");
        return;
      }
      maps.readyState = 2;
      try {
        maps.load(() => succeed(maps));
      } catch {
        succeed(maps);
      }
    };
    const handleMainError = () => fail("KAKAO_MAP_MODULE_REQUEST_FAILED");
    const activate = () => {
      const maps = window.kakao?.maps;
      if (!maps || typeof maps.load !== "function") {
        fail("KAKAO_SDK_INVALID");
        return;
      }
      if (typeof maps.Map === "function") {
        succeed(maps);
        return;
      }
      const version = maps.version;
      if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
        fail("KAKAO_MAP_VERSION_UNAVAILABLE");
        return;
      }
      const mainSource = `https://t1.daumcdn.net/mapjsapi/js/main/${version}/kakao.js`;
      if (mainScript && mainScript.src !== mainSource) {
        mainScript.remove();
        mainScript = null;
      }
      const shouldAppend = !mainScript;
      if (!mainScript) {
        mainScript = document.createElement("script");
        mainScript.id = kakaoMainSdkId;
        mainScript.src = mainSource;
        mainScript.async = true;
      }
      mainScript.addEventListener("load", handleMainLoad, { once: true });
      mainScript.addEventListener("error", handleMainError, { once: true });
      if (shouldAppend) document.head.appendChild(mainScript);
    };
    const handleError = () => fail("KAKAO_SDK_REQUEST_FAILED");

    timeoutId = window.setTimeout(() => fail("KAKAO_SDK_TIMEOUT"), 15_000);
    if (script) {
      if (window.kakao?.maps) activate();
      else {
        script.addEventListener("load", activate, { once: true });
        script.addEventListener("error", handleError, { once: true });
      }
      return;
    }

    script = document.createElement("script");
    script.id = kakaoSdkId;
    script.src = source;
    script.async = true;
    script.addEventListener("load", activate, { once: true });
    script.addEventListener("error", handleError, { once: true });
    document.head.appendChild(script);
  });

  kakaoSdkPromise = task.catch((error) => {
    kakaoSdkPromise = null;
    throw error;
  });
  return kakaoSdkPromise;
}

function visibleClusterCount(count: number) {
  return count >= 99 ? "99+" : String(count);
}

function distanceBetween(first: MapPoint, second: MapPoint) {
  const earthRadiusM = 6_371_000;
  const latitudeDelta = (second.latitude - first.latitude) * Math.PI / 180;
  const longitudeDelta = (second.longitude - first.longitude) * Math.PI / 180;
  const firstLatitude = first.latitude * Math.PI / 180;
  const secondLatitude = second.latitude * Math.PI / 180;
  const value = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusM * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function validMapPoint(point: MapPoint | null | undefined): point is MapPoint {
  return Boolean(point
    && Number.isFinite(point.latitude)
    && Number.isFinite(point.longitude)
    && Math.abs(point.latitude) <= 90
    && Math.abs(point.longitude) <= 180);
}

const markerIconPaths: Record<FacilityCategoryId, string> = {
  general: '<path d="M10 11v6"/><path d="M14 11v6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  recycle: '<path d="M7 19H4.815a1.83 1.83 0 0 1-1.57-.881 1.785 1.785 0 0 1-.004-1.784L7.196 9.5"/><path d="M11 19h8.203a1.83 1.83 0 0 0 1.556-.89 1.784 1.784 0 0 0 0-1.775l-1.226-2.12"/><path d="m14 16-3 3 3 3"/><path d="M8.293 13.596 7.196 9.5 3.1 10.598"/><path d="m9.344 5.811 1.093-1.892A1.83 1.83 0 0 1 11.985 3a1.784 1.784 0 0 1 1.546.888l3.943 6.843"/><path d="m13.378 9.633 4.096 1.098 1.097-4.096"/>',
  medicine: '<path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/>',
  battery: '<path d="m11 7-3 5h4l-3 5"/><path d="M14.856 6H16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.935"/><path d="M22 14v-4"/><path d="M5.14 18H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2.936"/>',
  clothes: '<path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/>',
  cigarette: '<path d="M17 12H3a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h14"/><path d="M18 8c0-2.5-2-2.5-2-5"/><path d="M21 16a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M22 8c0-2.5-2-2.5-2-5"/><path d="M7 12v4"/>',
};

function markerSource(categoryId: FacilityCategoryId) {
  const category = CATEGORY_BY_ID[categoryId];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="42" height="42" viewBox="0 0 42 42"><defs><filter id="s" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#17211e" flood-opacity=".28"/></filter></defs><rect x="1.5" y="1.5" width="39" height="39" rx="12.5" fill="${category.color}" filter="url(#s)"/><rect x="4.5" y="4.5" width="33" height="33" rx="9.5" fill="${category.softColor}"/><g transform="translate(9 9)" fill="none" stroke="${category.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${markerIconPaths[categoryId]}</g></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function placeMarkerSource() {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="46" viewBox="0 0 36 42"><defs><filter id="s" x="-30%" y="-25%" width="160%" height="160%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#0f172a" flood-opacity=".32"/></filter></defs><path d="M18 1C8.6 1 2 7.7 2 16.2c0 11.2 13.1 23 15.1 24.7.5.4 1.3.4 1.8 0C20.9 39.2 34 27.4 34 16.2 34 7.7 27.4 1 18 1Z" fill="#334155" stroke="#0f172a" stroke-width="2" filter="url(#s)"/><circle cx="18" cy="16" r="10.5" fill="#e2e8f0"/><g fill="none" stroke="#334155" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22V11h12v11M15 14h2M20 14h2M15 18h2M20 18h2M16 22v-3h4v3"/></g></svg>';
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function createLocationElement() {
  const element = document.createElement("div");
  element.style.width = "18px";
  element.style.height = "18px";
  element.style.border = "4px solid white";
  element.style.borderRadius = "50%";
  element.style.background = "#2563eb";
  element.style.boxShadow = "0 1px 8px rgba(37, 99, 235, 0.55)";
  return element;
}

function createLabelElement(title: string, badge: string, badgeColor: string) {
  const element = document.createElement("div");
  const badgeElement = document.createElement("span");
  const titleElement = document.createElement("span");
  badgeElement.textContent = badge;
  badgeElement.style.flexShrink = "0";
  badgeElement.style.borderRadius = "5px";
  badgeElement.style.background = badgeColor;
  badgeElement.style.padding = "3px 5px";
  badgeElement.style.color = "white";
  badgeElement.style.fontSize = "8px";
  badgeElement.style.fontWeight = "800";
  titleElement.textContent = title;
  titleElement.style.overflow = "hidden";
  titleElement.style.textOverflow = "ellipsis";
  titleElement.style.whiteSpace = "nowrap";
  element.append(badgeElement, titleElement);
  element.style.display = "flex";
  element.style.alignItems = "center";
  element.style.gap = "6px";
  element.style.maxWidth = "230px";
  element.style.border = "1px solid #d9e1dc";
  element.style.borderRadius = "8px";
  element.style.background = "white";
  element.style.padding = "6px 9px";
  element.style.color = "#17211e";
  element.style.fontSize = "11px";
  element.style.fontWeight = "700";
  element.style.boxShadow = "0 4px 12px rgba(23, 33, 30, 0.14)";
  return element;
}

function createAggregateClusterElement(cluster: FacilityCluster) {
  const category = cluster.categoryId ? CATEGORY_BY_ID[cluster.categoryId] : null;
  const color = category?.color ?? "#087b55";
  const borderColor = category?.color ?? "#075b42";
  const size = cluster.count >= 99 ? 50 : 46;
  const element = document.createElement("button");
  element.type = "button";
  element.textContent = visibleClusterCount(cluster.count);
  element.setAttribute("aria-label", `수거함 ${cluster.count.toLocaleString("ko-KR")}개 구역 확대`);
  element.style.width = `${size}px`;
  element.style.height = `${size}px`;
  element.style.border = `3px solid ${borderColor}`;
  element.style.borderRadius = "50%";
  element.style.background = color;
  element.style.color = "white";
  element.style.fontSize = "12px";
  element.style.fontWeight = "800";
  element.style.lineHeight = "1";
  element.style.cursor = "pointer";
  element.style.boxShadow = "0 3px 12px rgba(19, 57, 47, 0.3)";
  return element;
}

export const KakaoMap = forwardRef<KakaoMapHandle, KakaoMapProps>(function KakaoMap({
  facilities,
  clusters = emptyClusters,
  selectedId,
  onSelect,
  onViewportChange,
  onLocationChange,
  userLocation,
  focusedPlace,
  routePath = emptyRoutePath,
  className,
}, ref) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<KakaoMapInstance | null>(null);
  const markerBuildFrameRef = useRef<number | null>(null);
  const focusFrameRef = useRef<number | null>(null);
  const initialViewportTimerRef = useRef<number | null>(null);
  const markerGenerationRef = useRef(0);
  const markerRegistryRef = useRef(new Map<string, MarkerEntry>());
  const markerImagesRef = useRef(new Map<FacilityCategoryId, KakaoMarkerImageInstance>());
  const aggregateOverlaysRef = useRef<KakaoOverlayInstance[]>([]);
  const locationOverlayRef = useRef<KakaoOverlayInstance | null>(null);
  const accuracyCircleRef = useRef<KakaoCircleInstance | null>(null);
  const focusMarkerRef = useRef<KakaoMarkerInstance | null>(null);
  const labelOverlayRef = useRef<KakaoOverlayInstance | null>(null);
  const routePolylineRef = useRef<KakaoPolylineInstance | null>(null);
  const selectRef = useRef(onSelect);
  const viewportRef = useRef(onViewportChange);
  const locationRef = useRef(onLocationChange);
  const locationWatchRef = useRef<number | null>(null);
  const locationStopTimerRef = useRef<number | null>(null);
  const locationGenerationRef = useRef(0);
  const pendingLocationFocusRef = useRef<MapPoint | null>(null);
  const lastLocationRef = useRef<{ point: MapPoint; timestamp: number } | null>(null);
  const hybridRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const [scriptFailed, setScriptFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const appKey = process.env.NEXT_PUBLIC_KAKAO_MAP_APP_KEY;

  useEffect(() => {
    selectRef.current = onSelect;
    viewportRef.current = onViewportChange;
    locationRef.current = onLocationChange;
  }, [onLocationChange, onSelect, onViewportChange]);

  useEffect(() => {
    if (validMapPoint(userLocation) && !lastLocationRef.current) {
      lastLocationRef.current = { point: userLocation, timestamp: Date.now() };
    }
  }, [userLocation]);

  const reportViewport = useCallback(() => {
    const map = mapInstanceRef.current;
    const callback = viewportRef.current;
    if (!map || !callback) return;
    const bounds = map.getBounds();
    const southWest = bounds.getSouthWest();
    const northEast = bounds.getNorthEast();
    const container = mapContainerRef.current;
    const raw = [southWest.getLng(), southWest.getLat(), northEast.getLng(), northEast.getLat(), map.getLevel()];
    const width = container?.clientWidth ?? 0;
    const height = container?.clientHeight ?? 0;
    if (!raw.every(Number.isFinite) || width <= 0 || height <= 0) return;
    const west = Math.min(180, Math.max(-180, Number(raw[0]!.toFixed(5))));
    const south = Math.min(90, Math.max(-90, Number(raw[1]!.toFixed(5))));
    const east = Math.min(180, Math.max(-180, Number(raw[2]!.toFixed(5))));
    const north = Math.min(90, Math.max(-90, Number(raw[3]!.toFixed(5))));
    if (west >= east || south >= north) return;
    callback({ west, south, east, north, level: Math.max(1, Math.round(raw[4]!)), width, height });
  }, []);

  const focusLocation = useCallback((point: MapPoint) => {
    if (!validMapPoint(point)) return;
    const map = mapInstanceRef.current;
    const maps = window.kakao?.maps;
    if (!map || !maps) {
      pendingLocationFocusRef.current = point;
      return;
    }
    pendingLocationFocusRef.current = null;
    const position = new maps.LatLng(point.latitude, point.longitude);
    map.relayout();
    map.setCenter(position);
    if (map.getLevel() > 4) map.setLevel(4, { animate: false });
    map.setCenter(position);
    if (focusFrameRef.current !== null) window.cancelAnimationFrame(focusFrameRef.current);
    focusFrameRef.current = window.requestAnimationFrame(() => {
      focusFrameRef.current = null;
      const currentMap = mapInstanceRef.current;
      if (!currentMap) return;
      currentMap.relayout();
      currentMap.setCenter(position);
      reportViewport();
    });
  }, [reportViewport]);

  const initializeMap = useCallback(() => {
    const maps = window.kakao?.maps;
    if (!maps || !mapContainerRef.current || mapInstanceRef.current || typeof maps.Map !== "function") return;
    try {
      const map = new maps.Map(mapContainerRef.current, {
        center: new maps.LatLng(37.5665, 126.978),
        level: 7,
      });
      mapInstanceRef.current = map;
      maps.event.addListener(map, "zoom_changed", reportViewport);
      maps.event.addListener(map, "idle", reportViewport);
      setMapReady(true);
      if (pendingLocationFocusRef.current) focusLocation(pendingLocationFocusRef.current);
      initialViewportTimerRef.current = window.setTimeout(() => {
        initialViewportTimerRef.current = null;
        reportViewport();
      }, 0);
    } catch (error) {
      console.error("Kakao map initialization failed", error);
      setScriptFailed(true);
    }
  }, [focusLocation, reportViewport]);

  useEffect(() => {
    if (!appKey || normalizeLocalMapOrigin()) return;
    let active = true;
    setScriptFailed(false);
    loadKakaoMapsSdk(appKey)
      .then(() => {
        if (active) initializeMap();
      })
      .catch((error) => {
        if (!active) return;
        console.error("Kakao Maps SDK load failed", error);
        setScriptFailed(true);
      });
    return () => {
      active = false;
    };
  }, [appKey, initializeMap, loadAttempt]);

  useEffect(() => () => {
    locationGenerationRef.current += 1;
    markerGenerationRef.current += 1;
    if (markerBuildFrameRef.current !== null) window.cancelAnimationFrame(markerBuildFrameRef.current);
    if (focusFrameRef.current !== null) window.cancelAnimationFrame(focusFrameRef.current);
    if (initialViewportTimerRef.current !== null) window.clearTimeout(initialViewportTimerRef.current);
    if (locationWatchRef.current !== null) navigator.geolocation?.clearWatch(locationWatchRef.current);
    if (locationStopTimerRef.current !== null) window.clearTimeout(locationStopTimerRef.current);
    const maps = window.kakao?.maps;
    const map = mapInstanceRef.current;
    if (maps && map) {
      maps.event.removeListener(map, "zoom_changed", reportViewport);
      maps.event.removeListener(map, "idle", reportViewport);
    }
    markerRegistryRef.current.forEach(({ marker, clickHandler }) => {
      maps?.event.removeListener(marker, "click", clickHandler);
      marker.setMap(null);
    });
    markerRegistryRef.current.clear();
    aggregateOverlaysRef.current.forEach((overlay) => overlay.setMap(null));
    aggregateOverlaysRef.current = [];
    locationOverlayRef.current?.setMap(null);
    accuracyCircleRef.current?.setMap(null);
    focusMarkerRef.current?.setMap(null);
    labelOverlayRef.current?.setMap(null);
    routePolylineRef.current?.setMap(null);
    mapInstanceRef.current = null;
  }, [reportViewport]);

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !window.kakao) return;
    const maps = window.kakao.maps;
    const map = mapInstanceRef.current;
    const generation = ++markerGenerationRef.current;
    if (markerBuildFrameRef.current !== null) {
      window.cancelAnimationFrame(markerBuildFrameRef.current);
      markerBuildFrameRef.current = null;
    }

    const nextIds = new Set<string>();
    facilities.forEach((facility) => nextIds.add(facility.id));
    const removed: MarkerEntry[] = [];
    markerRegistryRef.current.forEach((entry, id) => {
      if (nextIds.has(id)) return;
      removed.push(entry);
      markerRegistryRef.current.delete(id);
    });
    if (removed.length) {
      removed.forEach(({ marker, clickHandler }) => {
        maps.event.removeListener(marker, "click", clickHandler);
        marker.setMap(null);
      });
    }

    const pending: Facility[] = [];
    for (const facility of facilities) {
      const existing = markerRegistryRef.current.get(facility.id);
      if (existing) {
        if (existing.facility.coordinates.latitude !== facility.coordinates.latitude || existing.facility.coordinates.longitude !== facility.coordinates.longitude) {
          existing.marker.setPosition(new maps.LatLng(facility.coordinates.latitude, facility.coordinates.longitude));
        }
        if (existing.facility.name !== facility.name) existing.marker.setTitle(facility.name);
        existing.facility = facility;
        const categoryId = getPrimaryCategory(facility).id;
        if (existing.categoryId !== categoryId) {
          let image = markerImagesRef.current.get(categoryId);
          if (!image) {
            image = new maps.MarkerImage(markerSource(categoryId), new maps.Size(42, 42), { offset: new maps.Point(21, 21) });
            markerImagesRef.current.set(categoryId, image);
          }
          existing.marker.setImage(image);
          existing.categoryId = categoryId;
        }
      } else {
        pending.push(facility);
      }
    }

    let index = 0;
    const buildBatch = () => {
      if (generation !== markerGenerationRef.current) return;
      const added: KakaoMarkerInstance[] = [];
      const startedAt = performance.now();
      while (index < pending.length && added.length < 160 && (added.length < 24 || performance.now() - startedAt < 6)) {
        const facility = pending[index];
        index += 1;
        const categoryId = getPrimaryCategory(facility).id;
        let image = markerImagesRef.current.get(categoryId);
        if (!image) {
          image = new maps.MarkerImage(markerSource(categoryId), new maps.Size(42, 42), { offset: new maps.Point(21, 21) });
          markerImagesRef.current.set(categoryId, image);
        }
        const marker = new maps.Marker({
          position: new maps.LatLng(facility.coordinates.latitude, facility.coordinates.longitude),
          title: facility.name,
          image,
        });
        const facilityId = facility.id;
        const clickHandler = () => {
          const current = markerRegistryRef.current.get(facilityId);
          if (current) selectRef.current(current.facility);
        };
        markerRegistryRef.current.set(facilityId, { facility, marker, categoryId, clickHandler });
        maps.event.addListener(marker, "click", clickHandler);
        added.push(marker);
      }
      added.forEach((marker) => marker.setMap(map));
      if (index < pending.length) {
        markerBuildFrameRef.current = window.requestAnimationFrame(buildBatch);
      } else {
        markerBuildFrameRef.current = null;
      }
    };

    if (pending.length) buildBatch();
  }, [facilities, mapReady]);

  useEffect(() => {
    aggregateOverlaysRef.current.forEach((overlay) => overlay.setMap(null));
    aggregateOverlaysRef.current = [];
    if (!mapReady || !mapInstanceRef.current || !window.kakao || clusters.length === 0) return;
    const maps = window.kakao.maps;
    const map = mapInstanceRef.current;
    aggregateOverlaysRef.current = clusters.map((cluster) => {
      const element = createAggregateClusterElement(cluster);
      element.addEventListener("click", (event) => {
        event.stopPropagation();
        const bounds = new maps.LatLngBounds();
        bounds.extend(new maps.LatLng(cluster.bounds.south, cluster.bounds.west));
        bounds.extend(new maps.LatLng(cluster.bounds.north, cluster.bounds.east));
        map.setBounds(bounds, 48, 48, 48, 48);
      });
      return new maps.CustomOverlay({
        map,
        position: new maps.LatLng(cluster.coordinates.latitude, cluster.coordinates.longitude),
        content: element,
        xAnchor: 0.5,
        yAnchor: 0.5,
        zIndex: 7,
      });
    });
  }, [clusters, mapReady]);

  useEffect(() => {
    locationOverlayRef.current?.setMap(null);
    accuracyCircleRef.current?.setMap(null);
    if (!mapReady || !mapInstanceRef.current || !window.kakao || !validMapPoint(userLocation)) return;
    const maps = window.kakao.maps;
    const position = new maps.LatLng(userLocation.latitude, userLocation.longitude);
    locationOverlayRef.current = new maps.CustomOverlay({
      map: mapInstanceRef.current,
      position,
      content: createLocationElement(),
      xAnchor: 0.5,
      yAnchor: 0.5,
      zIndex: 10,
    });
    if (userLocation.accuracy !== undefined && Number.isFinite(userLocation.accuracy)) {
      accuracyCircleRef.current = new maps.Circle({
        map: mapInstanceRef.current,
        center: position,
        radius: Math.min(2000, Math.max(10, userLocation.accuracy)),
        strokeWeight: 1,
        strokeColor: "#2563eb",
        strokeOpacity: 0.4,
        fillColor: "#3b82f6",
        fillOpacity: 0.09,
      });
    }
  }, [mapReady, userLocation]);

  useEffect(() => {
    routePolylineRef.current?.setMap(null);
    routePolylineRef.current = null;
    if (!mapReady || !mapInstanceRef.current || !window.kakao || routePath.length < 2) return;
    const maps = window.kakao.maps;
    const path = routePath.filter(validMapPoint).map((point) => new maps.LatLng(point.latitude, point.longitude));
    if (path.length < 2) return;
    routePolylineRef.current = new maps.Polyline({
      map: mapInstanceRef.current,
      path,
      strokeWeight: 6,
      strokeColor: "#087b55",
      strokeOpacity: 0.9,
      strokeStyle: "solid",
    });
    const bounds = new maps.LatLngBounds();
    path.forEach((position) => bounds.extend(position));
    mapInstanceRef.current.setBounds(bounds, 56, 56, 56, 56);
  }, [mapReady, routePath]);

  useEffect(() => {
    labelOverlayRef.current?.setMap(null);
    focusMarkerRef.current?.setMap(null);
    if (!mapReady || !mapInstanceRef.current || !window.kakao) return;
    const maps = window.kakao.maps;
    if (validMapPoint(focusedPlace)) {
      const position = new maps.LatLng(focusedPlace.latitude, focusedPlace.longitude);
      const image = new maps.MarkerImage(placeMarkerSource(), new maps.Size(40, 46), { offset: new maps.Point(20, 44) });
      focusMarkerRef.current = new maps.Marker({ map: mapInstanceRef.current, position, title: focusedPlace.title, image });
      labelOverlayRef.current = new maps.CustomOverlay({ map: mapInstanceRef.current, position, content: createLabelElement(focusedPlace.title, "장소", "#334155"), xAnchor: 0.5, yAnchor: 2.2, zIndex: 8 });
      return;
    }
    const selected = facilities.find((facility) => facility.id === selectedId);
    if (!selected) return;
    const position = new maps.LatLng(selected.coordinates.latitude, selected.coordinates.longitude);
    const category = getPrimaryCategory(selected);
    labelOverlayRef.current = new maps.CustomOverlay({ map: mapInstanceRef.current, position, content: createLabelElement(selected.name, "수거함", category.color), xAnchor: 0.5, yAnchor: 2.2, zIndex: 8 });
  }, [facilities, focusedPlace, mapReady, selectedId]);

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !mapContainerRef.current) return;
    const map = mapInstanceRef.current;
    const container = mapContainerRef.current;
    let frame: number | null = null;
    const observer = new ResizeObserver(() => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        map.relayout();
        reportViewport();
        frame = null;
      });
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [mapReady, reportViewport]);

  useEffect(() => {
    if (!appKey || mapReady || scriptFailed) return;
    const timeout = window.setTimeout(() => setScriptFailed(true), 10000);
    return () => window.clearTimeout(timeout);
  }, [appKey, mapReady, scriptFailed]);

  useImperativeHandle(ref, () => ({
    locate() {
      if (!window.isSecureContext && !["localhost", "127.0.0.1"].includes(window.location.hostname)) return Promise.reject(new Error("INSECURE_CONTEXT"));
      if (!navigator.geolocation) return Promise.reject(new Error("GEOLOCATION_UNAVAILABLE"));
      if (locationWatchRef.current !== null) navigator.geolocation.clearWatch(locationWatchRef.current);
      if (locationStopTimerRef.current !== null) window.clearTimeout(locationStopTimerRef.current);

      return new Promise<MapPoint>((resolve, reject) => {
        const generation = ++locationGenerationRef.current;
        const requestStartedAt = Date.now();
        const knownLocation = lastLocationRef.current;
        let resolved = Boolean(knownLocation);
        let latestPoint = knownLocation?.point ?? null;
        let latestTimestamp = knownLocation?.timestamp ?? 0;
        let bestAccuracy = knownLocation?.point.accuracy ?? Number.POSITIVE_INFINITY;
        let hasCurrentFix = false;

        if (knownLocation) {
          focusLocation(knownLocation.point);
          resolve(knownLocation.point);
        }

        const stop = () => {
          if (locationWatchRef.current !== null) navigator.geolocation.clearWatch(locationWatchRef.current);
          if (locationStopTimerRef.current !== null) window.clearTimeout(locationStopTimerRef.current);
          locationWatchRef.current = null;
          locationStopTimerRef.current = null;
        };
        const update = (position: GeolocationPosition, highAccuracy: boolean) => {
          if (generation !== locationGenerationRef.current) return;
          const { latitude, longitude } = position.coords;
          if (![latitude, longitude].every(Number.isFinite) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return;
          const accuracy = Number.isFinite(position.coords.accuracy) && position.coords.accuracy >= 0
            ? position.coords.accuracy
            : Number.POSITIVE_INFINITY;
          const timestamp = Number.isFinite(position.timestamp) ? position.timestamp : Date.now();
          const point: MapPoint = {
            latitude,
            longitude,
            ...(Number.isFinite(accuracy) ? { accuracy } : {}),
          };
          const currentFix = timestamp >= requestStartedAt - 10_000;
          const movedDistance = latestPoint ? distanceBetween(latestPoint, point) : Number.POSITIVE_INFINITY;
          const previousAccuracy = latestPoint?.accuracy ?? Number.POSITIVE_INFINITY;
          const uncertainty = Math.max(
            60,
            Math.min(2000, (Number.isFinite(previousAccuracy) ? previousAccuracy : 500) + (Number.isFinite(accuracy) ? accuracy : 500)),
          );
          const movedBeyondUncertainty = movedDistance > uncertainty;
          const improvesFix = accuracy < bestAccuracy * 0.85;
          const newerFix = timestamp > latestTimestamp + 250;
          if (latestPoint && !(currentFix && !hasCurrentFix) && !improvesFix && !(newerFix && movedBeyondUncertainty)) {
            if (highAccuracy && currentFix && accuracy <= 30) stop();
            return;
          }
          hasCurrentFix ||= currentFix;
          latestPoint = point;
          latestTimestamp = timestamp;
          bestAccuracy = accuracy;
          lastLocationRef.current = { point, timestamp };
          locationRef.current?.(point);
          focusLocation(point);
          if (!resolved) {
            resolved = true;
            resolve(point);
          }
          if (highAccuracy && currentFix && accuracy <= 30) stop();
        };
        const fail = (error: GeolocationPositionError) => {
          if (generation !== locationGenerationRef.current) return;
          if (error.code !== error.PERMISSION_DENIED) return;
          stop();
          if (!resolved) reject(new Error("GEOLOCATION_DENIED"));
        };

        try {
          navigator.geolocation.getCurrentPosition((position) => update(position, false), fail, {
            enableHighAccuracy: false,
            timeout: 1500,
            maximumAge: 300_000,
          });
          navigator.geolocation.getCurrentPosition((position) => update(position, false), fail, {
            enableHighAccuracy: false,
            timeout: 6000,
            maximumAge: 0,
          });
          locationWatchRef.current = navigator.geolocation.watchPosition((position) => update(position, true), fail, {
            enableHighAccuracy: true,
            timeout: 15_000,
            maximumAge: 0,
          });
        } catch {
          locationGenerationRef.current += 1;
          stop();
          if (!resolved) reject(new Error("GEOLOCATION_UNAVAILABLE"));
          return;
        }
        locationStopTimerRef.current = window.setTimeout(() => {
          if (generation !== locationGenerationRef.current) return;
          stop();
          if (!resolved) reject(new Error("GEOLOCATION_TIMEOUT"));
        }, 20_000);
      });
    },
    moveTo(point, level = 4) {
      if (!mapInstanceRef.current || !window.kakao || !validMapPoint(point)) return;
      mapInstanceRef.current.panTo(new window.kakao.maps.LatLng(point.latitude, point.longitude));
      mapInstanceRef.current.setLevel(level, { animate: { duration: 180 } });
    },
    zoomIn() {
      const map = mapInstanceRef.current;
      if (map) map.setLevel(Math.max(1, map.getLevel() - 1), { animate: { duration: 160 } });
    },
    zoomOut() {
      const map = mapInstanceRef.current;
      if (map) map.setLevel(Math.min(14, map.getLevel() + 1), { animate: { duration: 160 } });
    },
    toggleMapType() {
      if (!mapInstanceRef.current || !window.kakao) return;
      hybridRef.current = !hybridRef.current;
      mapInstanceRef.current.setMapTypeId(hybridRef.current ? window.kakao.maps.MapTypeId.HYBRID : window.kakao.maps.MapTypeId.ROADMAP);
    },
  }), [focusLocation]);

  const loadMessage = !appKey
    ? "현재 지도를 불러올 수 없습니다."
    : scriptFailed
      ? "카카오 지도를 불러오지 못했습니다."
      : "지도를 불러오는 중입니다.";

  return (
    <div className={cn("relative isolate overflow-hidden bg-[#eef0e9]", className)}>
      <div ref={mapContainerRef} className={cn("absolute inset-0 transition-opacity", mapReady ? "opacity-100" : "opacity-0")} aria-label="카카오 지도" />
      {!mapReady && (
        <div className="absolute inset-0 grid place-items-center bg-[#eef0e9]">
          <div className="rounded-2xl bg-white/95 px-5 py-4 text-center shadow-lg">
            {appKey && !scriptFailed ? <LoaderCircle className="mx-auto size-5 animate-spin text-[var(--brand)]" /> : <MapPin className="mx-auto size-5 text-amber-500" />}
            <p className="mt-2 text-[12px] font-bold text-[var(--sub)]">{loadMessage}</p>
            {appKey && scriptFailed && <button type="button" onClick={() => setLoadAttempt((attempt) => attempt + 1)} className="mt-3 rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[10px] font-extrabold text-[var(--ink)]">다시 시도</button>}
          </div>
        </div>
      )}
    </div>
  );
});
