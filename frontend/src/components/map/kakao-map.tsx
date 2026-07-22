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

export interface KakaoMapHandle {
  locate: () => void;
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
  setLevel: (level: number) => void;
  setCenter: (position: KakaoLatLng) => void;
  panTo: (position: KakaoLatLng) => void;
  getBounds: () => KakaoBounds;
  setMapTypeId: (mapTypeId: number) => void;
}

interface KakaoMarkerInstance {
  setMap: (map: KakaoMapInstance | null) => void;
}

interface KakaoInfoWindowInstance {
  open: (map: KakaoMapInstance, marker: KakaoMarkerInstance) => void;
  close: () => void;
}

interface KakaoMapsApi {
  load: (callback: () => void) => void;
  LatLng: new (latitude: number, longitude: number) => KakaoLatLng;
  Map: new (container: HTMLElement, options: { center: KakaoLatLng; level: number }) => KakaoMapInstance;
  Marker: new (options: { map: KakaoMapInstance; position: KakaoLatLng; title: string }) => KakaoMarkerInstance;
  InfoWindow: new (options: { content: HTMLElement; removable: boolean }) => KakaoInfoWindowInstance;
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
  className?: string;
}

export const KakaoMap = forwardRef<KakaoMapHandle, KakaoMapProps>(function KakaoMap({
  facilities,
  selectedId,
  onSelect,
  onViewportChange,
  onLocationChange,
  userLocation,
  className,
}, ref) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<KakaoMapInstance | null>(null);
  const markerRefs = useRef<Array<{ facility: Facility; marker: KakaoMarkerInstance }>>([]);
  const locationMarkerRef = useRef<KakaoMarkerInstance | null>(null);
  const infoWindowRef = useRef<KakaoInfoWindowInstance | null>(null);
  const facilitiesRef = useRef(facilities);
  const selectRef = useRef(onSelect);
  const viewportRef = useRef(onViewportChange);
  const locationRef = useRef(onLocationChange);
  const centeredRef = useRef(false);
  const hybridRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const [scriptFailed, setScriptFailed] = useState(false);
  const appKey = process.env.NEXT_PUBLIC_KAKAO_MAP_APP_KEY;

  useEffect(() => {
    facilitiesRef.current = facilities;
    selectRef.current = onSelect;
    viewportRef.current = onViewportChange;
    locationRef.current = onLocationChange;
  }, [facilities, onLocationChange, onSelect, onViewportChange]);

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
      const initialFacility = facilitiesRef.current[0];
      const centerPoint = initialFacility?.coordinates ?? { latitude: 36.5, longitude: 127.8 };
      const map = new maps.Map(mapContainerRef.current, {
        center: new maps.LatLng(centerPoint.latitude, centerPoint.longitude),
        level: initialFacility ? 5 : 13,
      });
      mapInstanceRef.current = map;
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
    const map = mapInstanceRef.current;
    const maps = window.kakao.maps;
    markerRefs.current.forEach(({ marker }) => marker.setMap(null));
    markerRefs.current = facilities.map((facility) => {
      const marker = new maps.Marker({
        map,
        position: new maps.LatLng(facility.coordinates.latitude, facility.coordinates.longitude),
        title: facility.name,
      });
      maps.event.addListener(marker, "click", () => selectRef.current(facility));
      return { facility, marker };
    });

    if (!centeredRef.current && facilities[0] && !userLocation) {
      map.setCenter(new maps.LatLng(facilities[0].coordinates.latitude, facilities[0].coordinates.longitude));
      map.setLevel(5);
      centeredRef.current = true;
    }
  }, [facilities, mapReady, userLocation]);

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !window.kakao || !userLocation) return;
    const maps = window.kakao.maps;
    const position = new maps.LatLng(userLocation.latitude, userLocation.longitude);
    locationMarkerRef.current?.setMap(null);
    locationMarkerRef.current = new maps.Marker({
      map: mapInstanceRef.current,
      position,
      title: "현재 위치",
    });
    if (!centeredRef.current) {
      mapInstanceRef.current.setCenter(position);
      mapInstanceRef.current.setLevel(5);
      centeredRef.current = true;
    }
  }, [mapReady, userLocation]);

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !window.kakao) return;
    infoWindowRef.current?.close();
    const selected = markerRefs.current.find(({ facility }) => facility.id === selectedId);
    if (!selected) return;
    const content = document.createElement("div");
    content.className = "whitespace-nowrap px-3 py-2 text-xs font-bold text-[#17211e]";
    content.textContent = selected.facility.name;
    const infoWindow = new window.kakao.maps.InfoWindow({ content, removable: false });
    infoWindow.open(mapInstanceRef.current, selected.marker);
    infoWindowRef.current = infoWindow;
  }, [facilities, mapReady, selectedId]);

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
        const point = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        locationRef.current?.(point);
        if (mapInstanceRef.current && window.kakao) {
          mapInstanceRef.current.panTo(new window.kakao.maps.LatLng(point.latitude, point.longitude));
          mapInstanceRef.current.setLevel(5);
        }
      }, () => undefined, { enableHighAccuracy: true, timeout: 8000 });
    },
    zoomIn() {
      const map = mapInstanceRef.current;
      if (map) map.setLevel(Math.max(1, map.getLevel() - 1));
    },
    zoomOut() {
      const map = mapInstanceRef.current;
      if (map) map.setLevel(Math.min(14, map.getLevel() + 1));
    },
    toggleMapType() {
      if (!mapInstanceRef.current || !window.kakao) return;
      hybridRef.current = !hybridRef.current;
      mapInstanceRef.current.setMapTypeId(
        hybridRef.current ? window.kakao.maps.MapTypeId.HYBRID : window.kakao.maps.MapTypeId.ROADMAP,
      );
    },
  }), []);

  const loadMessage = !appKey
    ? "카카오 지도 키가 설정되지 않았습니다."
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
        <Script
          id="kakao-map-sdk"
          src={`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false&libraries=clusterer`}
          strategy="afterInteractive"
          onReady={initializeMap}
          onError={() => setScriptFailed(true)}
        />
      )}
    </div>
  );
});
