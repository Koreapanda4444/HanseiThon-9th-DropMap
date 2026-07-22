"use client";

import { LoaderCircle, MapPin } from "lucide-react";
import Script from "next/script";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { Facility } from "@/types/domain";

export interface MapPoint {
  latitude: number;
  longitude: number;
}

export interface MapViewport {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface MapFocusPoint extends MapPoint {
  title: string;
}

export interface KakaoMapHandle {
  locate: () => void;
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
  panTo: (position: KakaoLatLng) => void;
  getBounds: () => KakaoBounds;
  setMapTypeId: (mapTypeId: number) => void;
}

type KakaoMarkerImageInstance = object;
type KakaoSizeInstance = object;
type KakaoPointInstance = object;

interface KakaoMarkerInstance {
  setMap: (map: KakaoMapInstance | null) => void;
}

interface KakaoOverlayInstance {
  setMap: (map: KakaoMapInstance | null) => void;
}

interface KakaoClustererInstance {
  addMarkers: (markers: KakaoMarkerInstance[]) => void;
  clear: () => void;
}

interface KakaoMapsApi {
  load: (callback: () => void) => void;
  LatLng: new (latitude: number, longitude: number) => KakaoLatLng;
  Size: new (width: number, height: number) => KakaoSizeInstance;
  Point: new (x: number, y: number) => KakaoPointInstance;
  Map: new (container: HTMLElement, options: { center: KakaoLatLng; level: number }) => KakaoMapInstance;
  MarkerImage: new (source: string, size: KakaoSizeInstance, options: { offset: KakaoPointInstance }) => KakaoMarkerImageInstance;
  Marker: new (options: { map?: KakaoMapInstance; position: KakaoLatLng; title: string; image?: KakaoMarkerImageInstance }) => KakaoMarkerInstance;
  CustomOverlay: new (options: { map?: KakaoMapInstance; position: KakaoLatLng; content: HTMLElement; xAnchor?: number; yAnchor?: number; zIndex?: number }) => KakaoOverlayInstance;
  MarkerClusterer: new (options: { map: KakaoMapInstance; averageCenter: boolean; minLevel: number; disableClickZoom: boolean; styles: Array<Record<string, string>> }) => KakaoClustererInstance;
  MapTypeId: {
    ROADMAP: number;
    HYBRID: number;
  };
  event: {
    addListener: (target: KakaoMapInstance | KakaoMarkerInstance, event: string, callback: () => void) => void;
  };
}

declare global {
  interface Window {
    kakao?: { maps: KakaoMapsApi };
  }
}

interface KakaoMapProps {
  facilities: Facility[];
  selectedId: string | null;
  onSelect: (facility: Facility) => void;
  onViewportChange?: (viewport: MapViewport) => void;
  onLocationChange?: (point: MapPoint) => void;
  userLocation?: MapPoint | null;
  focusedPlace?: MapFocusPoint | null;
  className?: string;
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

function createLabelElement(title: string) {
  const element = document.createElement("div");
  element.textContent = title;
  element.style.whiteSpace = "nowrap";
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

export const KakaoMap = forwardRef<KakaoMapHandle, KakaoMapProps>(function KakaoMap({
  facilities,
  selectedId,
  onSelect,
  onViewportChange,
  onLocationChange,
  userLocation,
  focusedPlace,
  className,
}, ref) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<KakaoMapInstance | null>(null);
  const clustererRef = useRef<KakaoClustererInstance | null>(null);
  const markerRefs = useRef<Array<{ facility: Facility; marker: KakaoMarkerInstance }>>([]);
  const locationOverlayRef = useRef<KakaoOverlayInstance | null>(null);
  const focusMarkerRef = useRef<KakaoMarkerInstance | null>(null);
  const labelOverlayRef = useRef<KakaoOverlayInstance | null>(null);
  const selectRef = useRef(onSelect);
  const viewportRef = useRef(onViewportChange);
  const locationRef = useRef(onLocationChange);
  const hybridRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const [scriptFailed, setScriptFailed] = useState(false);
  const appKey = process.env.NEXT_PUBLIC_KAKAO_MAP_APP_KEY;

  useEffect(() => {
    selectRef.current = onSelect;
    viewportRef.current = onViewportChange;
    locationRef.current = onLocationChange;
  }, [onLocationChange, onSelect, onViewportChange]);

  const reportViewport = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const bounds = map.getBounds();
    const southWest = bounds.getSouthWest();
    const northEast = bounds.getNorthEast();
    viewportRef.current?.({
      west: Number(southWest.getLng().toFixed(6)),
      south: Number(southWest.getLat().toFixed(6)),
      east: Number(northEast.getLng().toFixed(6)),
      north: Number(northEast.getLat().toFixed(6)),
    });
  }, []);

  const initializeMap = useCallback(() => {
    if (!mapContainerRef.current || !window.kakao || mapInstanceRef.current) return;
    const maps = window.kakao.maps;
    let secureLoaderObserver: MutationObserver | null = null;
    if (window.location.protocol === "http:" && ["localhost", "127.0.0.1"].includes(window.location.hostname)) {
      secureLoaderObserver = new MutationObserver((records) => {
        for (const record of records) {
          for (const node of record.addedNodes) {
            if (node instanceof HTMLScriptElement && node.src.startsWith("http://t1.daumcdn.net/mapjsapi/")) {
              const secureScript = document.createElement("script");
              secureScript.src = node.src.replace("http://", "https://");
              secureScript.async = node.async;
              secureScript.charset = node.charset;
              node.replaceWith(secureScript);
            }
          }
        }
      });
      secureLoaderObserver.observe(document.head, { childList: true, subtree: true });
    }
    const createMap = () => {
      secureLoaderObserver?.disconnect();
      if (!mapContainerRef.current || mapInstanceRef.current || typeof maps.Map !== "function") return;
      const map = new maps.Map(mapContainerRef.current, {
        center: new maps.LatLng(37.5665, 126.978),
        level: 7,
      });
      mapInstanceRef.current = map;
      clustererRef.current = new maps.MarkerClusterer({
        map,
        averageCenter: true,
        minLevel: 6,
        disableClickZoom: false,
        styles: [{
          width: "40px",
          height: "40px",
          background: "rgba(8, 123, 85, 0.92)",
          border: "3px solid rgba(255, 255, 255, 0.9)",
          borderRadius: "50%",
          color: "#ffffff",
          textAlign: "center",
          fontSize: "12px",
          fontWeight: "800",
          lineHeight: "34px",
          boxShadow: "0 3px 10px rgba(19, 57, 47, 0.28)",
        }],
      });
      maps.event.addListener(map, "idle", reportViewport);
      setMapReady(true);
      window.setTimeout(reportViewport, 0);
    };
    maps.load(createMap);
    const readinessCheck = window.setInterval(createMap, 150);
    window.setTimeout(() => {
      window.clearInterval(readinessCheck);
      secureLoaderObserver?.disconnect();
    }, 10000);
  }, [reportViewport]);

  useEffect(() => {
    if (window.kakao) initializeMap();
  }, [initializeMap]);

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !window.kakao) return;
    const maps = window.kakao.maps;
    clustererRef.current?.clear();
    markerRefs.current.forEach(({ marker }) => marker.setMap(null));
    const image = new maps.MarkerImage(
      "/assets/brand-symbol.png",
      new maps.Size(42, 42),
      { offset: new maps.Point(21, 39) },
    );
    markerRefs.current = facilities.map((facility) => {
      const marker = new maps.Marker({
        position: new maps.LatLng(facility.coordinates.latitude, facility.coordinates.longitude),
        title: facility.name,
        image,
      });
      maps.event.addListener(marker, "click", () => selectRef.current(facility));
      return { facility, marker };
    });
    if (clustererRef.current) clustererRef.current.addMarkers(markerRefs.current.map(({ marker }) => marker));
    else markerRefs.current.forEach(({ marker }) => marker.setMap(mapInstanceRef.current));
  }, [facilities, mapReady]);

  useEffect(() => {
    locationOverlayRef.current?.setMap(null);
    if (!mapReady || !mapInstanceRef.current || !window.kakao || !userLocation) return;
    const maps = window.kakao.maps;
    locationOverlayRef.current = new maps.CustomOverlay({
      map: mapInstanceRef.current,
      position: new maps.LatLng(userLocation.latitude, userLocation.longitude),
      content: createLocationElement(),
      xAnchor: 0.5,
      yAnchor: 0.5,
      zIndex: 10,
    });
  }, [mapReady, userLocation]);

  useEffect(() => {
    labelOverlayRef.current?.setMap(null);
    focusMarkerRef.current?.setMap(null);
    if (!mapReady || !mapInstanceRef.current || !window.kakao) return;
    const maps = window.kakao.maps;
    if (focusedPlace) {
      const position = new maps.LatLng(focusedPlace.latitude, focusedPlace.longitude);
      const image = new maps.MarkerImage("/assets/brand-symbol.png", new maps.Size(46, 46), { offset: new maps.Point(23, 42) });
      focusMarkerRef.current = new maps.Marker({ map: mapInstanceRef.current, position, title: focusedPlace.title, image });
      labelOverlayRef.current = new maps.CustomOverlay({ map: mapInstanceRef.current, position, content: createLabelElement(focusedPlace.title), xAnchor: 0.5, yAnchor: 2.3, zIndex: 8 });
      return;
    }
    const selected = facilities.find((facility) => facility.id === selectedId);
    if (!selected) return;
    const position = new maps.LatLng(selected.coordinates.latitude, selected.coordinates.longitude);
    labelOverlayRef.current = new maps.CustomOverlay({ map: mapInstanceRef.current, position, content: createLabelElement(selected.name), xAnchor: 0.5, yAnchor: 2.3, zIndex: 8 });
  }, [facilities, focusedPlace, mapReady, selectedId]);

  useEffect(() => {
    if (mapReady && mapInstanceRef.current) mapInstanceRef.current.relayout();
  }, [mapReady]);

  useEffect(() => {
    if (!appKey || mapReady || scriptFailed) return;
    const timeout = window.setTimeout(() => setScriptFailed(true), 10000);
    return () => window.clearTimeout(timeout);
  }, [appKey, mapReady, scriptFailed]);

  useImperativeHandle(ref, () => ({
    locate() {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition((position) => {
        const point = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        locationRef.current?.(point);
        if (mapInstanceRef.current && window.kakao) {
          mapInstanceRef.current.panTo(new window.kakao.maps.LatLng(point.latitude, point.longitude));
          mapInstanceRef.current.setLevel(4, { animate: { duration: 250 } });
        }
      }, () => undefined, { enableHighAccuracy: true, timeout: 8000 });
    },
    moveTo(point, level = 4) {
      if (!mapInstanceRef.current || !window.kakao) return;
      mapInstanceRef.current.panTo(new window.kakao.maps.LatLng(point.latitude, point.longitude));
      mapInstanceRef.current.setLevel(level, { animate: { duration: 250 } });
    },
    zoomIn() {
      const map = mapInstanceRef.current;
      if (map) map.setLevel(Math.max(1, map.getLevel() - 1), { animate: { duration: 220 } });
    },
    zoomOut() {
      const map = mapInstanceRef.current;
      if (map) map.setLevel(Math.min(14, map.getLevel() + 1), { animate: { duration: 220 } });
    },
    toggleMapType() {
      if (!mapInstanceRef.current || !window.kakao) return;
      hybridRef.current = !hybridRef.current;
      mapInstanceRef.current.setMapTypeId(hybridRef.current ? window.kakao.maps.MapTypeId.HYBRID : window.kakao.maps.MapTypeId.ROADMAP);
    },
  }), []);

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
          </div>
        </div>
      )}
      {appKey && !scriptFailed && (
        <Script id="kakao-map-sdk" src={`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false&libraries=clusterer`} strategy="afterInteractive" onReady={initializeMap} onError={() => setScriptFailed(true)} />
      )}
    </div>
  );
});
