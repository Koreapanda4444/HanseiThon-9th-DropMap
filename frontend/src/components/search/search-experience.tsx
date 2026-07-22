"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Camera, CheckCircle2, ChevronRight, History, ImagePlus, Info, LoaderCircle, LocateFixed, Search, TriangleAlert, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { FacilityCard } from "@/components/facilities/facility-card";
import { CameraCapture } from "@/components/search/camera-capture";
import { PhotoAnalysisFlow, type PreparedImage } from "@/components/search/photo-analysis";
import { CategoryIcon } from "@/components/ui/category-icon";
import { PageHeader } from "@/components/ui/page-header";
import { CATEGORY_BY_ID } from "@/config/facility-categories";
import { classifyWaste, fetchFacilities, fetchWasteItems } from "@/lib/api";
import { useAppStore } from "@/store/use-app-store";

function blobDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("INVALID_IMAGE"));
    reader.onerror = () => reject(new Error("INVALID_IMAGE"));
    reader.readAsDataURL(blob);
  });
}

async function prepareImage(file: File): Promise<PreparedImage> {
  if (!file.type.match(/^image\/(jpeg|png|webp)$/)) throw new Error("지원하지 않는 이미지 형식입니다.");
  if (file.size > 12 * 1024 * 1024) throw new Error("사진은 12MB 이하로 선택해 주세요.");
  const bitmap = await createImageBitmap(file);
  if (bitmap.width * bitmap.height > 40_000_000) {
    bitmap.close();
    throw new Error("사진 해상도가 너무 큽니다.");
  }
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("사진을 불러오지 못했습니다.");
  }
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error("사진을 변환하지 못했습니다.")), "image/jpeg", 0.86));
  if (blob.size > 4 * 1024 * 1024) throw new Error("사진 용량을 줄인 뒤 다시 선택해 주세요.");
  return {
    id: `${Date.now()}-${file.name}-${blob.size}`,
    dataUrl: await blobDataUrl(blob),
    previewUrl: URL.createObjectURL(blob),
    width,
    height,
  };
}

export function SearchExperience({ initialQuery = "" }: { initialQuery?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [photo, setPhoto] = useState<PreparedImage | null>(null);
  const [photoError, setPhotoError] = useState("");
  const [preparingPhoto, setPreparingPhoto] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<"idle" | "loading" | "ready" | "unavailable">("idle");
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const initialSearchDone = useRef(false);
  const locationRequestStarted = useRef(false);
  const locationWatchRef = useRef<number | null>(null);
  const locationTimerRef = useRef<number | null>(null);
  const locationGenerationRef = useRef(0);
  const recentSearches = useAppStore((state) => state.recentSearches);
  const addRecentSearch = useAppStore((state) => state.addRecentSearch);
  const removeRecentSearch = useAppStore((state) => state.removeRecentSearch);
  const clearRecentSearches = useAppStore((state) => state.clearRecentSearches);
  const setSelectedCategoryId = useAppStore((state) => state.setSelectedCategoryId);
  const classification = useMutation({ mutationFn: classifyWaste });
  const availableItems = useQuery({ queryKey: ["waste-items"], queryFn: ({ signal }) => fetchWasteItems(signal) });
  const primaryResult = classification.data?.[0];
  const relatedFacilities = useQuery({
    queryKey: ["nearby-facilities", primaryResult?.categoryId, userLocation?.latitude, userLocation?.longitude],
    queryFn: ({ signal }) => fetchFacilities({
      categoryId: primaryResult?.categoryId,
      latitude: userLocation?.latitude,
      longitude: userLocation?.longitude,
      limit: 3,
    }, signal),
    enabled: Boolean(primaryResult && userLocation),
  });

  const stopLocationTracking = useCallback(() => {
    if (locationWatchRef.current !== null) navigator.geolocation?.clearWatch(locationWatchRef.current);
    if (locationTimerRef.current !== null) window.clearTimeout(locationTimerRef.current);
    locationWatchRef.current = null;
    locationTimerRef.current = null;
  }, []);

  const requestCurrentLocation = useCallback(() => {
    if ((!window.isSecureContext && !["localhost", "127.0.0.1"].includes(window.location.hostname)) || !navigator.geolocation) {
      setLocationStatus("unavailable");
      return;
    }
    stopLocationTracking();
    const generation = ++locationGenerationRef.current;
    let received = false;
    let latestTimestamp = 0;
    setLocationStatus("loading");
    const update = (position: GeolocationPosition, highAccuracy: boolean) => {
      if (generation !== locationGenerationRef.current) return;
      const { latitude, longitude } = position.coords;
      if (![latitude, longitude].every(Number.isFinite) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return;
      if (position.timestamp < latestTimestamp) return;
      latestTimestamp = position.timestamp;
      received = true;
      setUserLocation({
        latitude,
        longitude,
      });
      setLocationStatus("ready");
      if (highAccuracy && position.coords.accuracy <= 40) stopLocationTracking();
    };
    const fail = (error: GeolocationPositionError) => {
      if (generation !== locationGenerationRef.current || error.code !== error.PERMISSION_DENIED) return;
      stopLocationTracking();
      setUserLocation(null);
      setLocationStatus("unavailable");
    };
    try {
      navigator.geolocation.getCurrentPosition((position) => update(position, false), fail, {
        enableHighAccuracy: false,
        timeout: 3500,
        maximumAge: 300_000,
      });
      locationWatchRef.current = navigator.geolocation.watchPosition((position) => update(position, true), fail, {
        enableHighAccuracy: true,
        timeout: 15_000,
        maximumAge: 0,
      });
    } catch {
      locationGenerationRef.current += 1;
      stopLocationTracking();
      setUserLocation(null);
      setLocationStatus("unavailable");
      return;
    }
    locationTimerRef.current = window.setTimeout(() => {
      if (generation !== locationGenerationRef.current) return;
      stopLocationTracking();
      if (!received) {
        setUserLocation(null);
        setLocationStatus("unavailable");
      }
    }, 20_000);
  }, [stopLocationTracking]);

  useEffect(() => () => {
    locationGenerationRef.current += 1;
    stopLocationTracking();
  }, [stopLocationTracking]);

  useEffect(() => {
    if (!primaryResult || locationRequestStarted.current) return;
    locationRequestStarted.current = true;
    requestCurrentLocation();
  }, [primaryResult, requestCurrentLocation]);

  useEffect(() => () => {
    if (photo) URL.revokeObjectURL(photo.previewUrl);
  }, [photo]);

  async function loadPhoto(file: File) {
    setPhotoError("");
    setPreparingPhoto(true);
    try {
      setPhoto(await prepareImage(file));
      return true;
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : "사진을 불러오지 못했습니다.");
      return false;
    } finally {
      setPreparingPhoto(false);
    }
  }

  async function handlePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) await loadPhoto(file);
  }

  function runSearch(value: string) {
    const normalized = value.trim();
    if (!normalized) return;
    setQuery(normalized);
    addRecentSearch(normalized);
    classification.mutate(normalized);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runSearch(query);
  }

  useEffect(() => {
    if (!initialQuery || initialSearchDone.current) return;
    initialSearchDone.current = true;
    addRecentSearch(initialQuery);
    classification.mutate(initialQuery);
  }, [addRecentSearch, classification, initialQuery]);

  function openMap() {
    if (!primaryResult) return;
    setSelectedCategoryId(primaryResult.categoryId);
    router.push("/");
  }

  if (photo) {
    return <PhotoAnalysisFlow image={photo} onClose={() => setPhoto(null)} onRetake={() => { setPhoto(null); setCameraOpen(true); }} onOpenMap={(categoryId) => { setSelectedCategoryId(categoryId); router.push("/"); }} />;
  }

  return (
    <>
      {cameraOpen && <CameraCapture onClose={() => setCameraOpen(false)} onCapture={async (file) => {
        const accepted = await loadPhoto(file);
        if (accepted) setCameraOpen(false);
        return accepted;
      }} />}
      <div className="min-h-[calc(100dvh-138px)] bg-[var(--app-bg)] px-4 py-6 sm:px-6 lg:min-h-[calc(100dvh-68px)] lg:py-9">
      <div className="mx-auto max-w-[1040px]">
        <PageHeader title="품목 검색" description="버릴 물건의 이름으로 배출 방법과 수거 장소를 확인하세요." />

        <section className="mt-5 rounded-[18px] border border-[var(--line)] bg-white p-3 sm:p-4">
          <form onSubmit={handleSubmit} className="flex h-13 items-center rounded-xl border border-[#d9e0dc] bg-[#f8faf9] px-3 transition focus-within:border-[var(--brand)] focus-within:bg-white focus-within:ring-3 focus-within:ring-[var(--brand)]/10">
            <Search className="size-5 shrink-0 text-[#68746e]" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} maxLength={200} placeholder="예: 보조배터리, 형광등, 감기약" aria-label="버릴 품목 검색" className="h-full min-w-0 flex-1 bg-transparent px-3 text-[14px] font-semibold text-[var(--ink)] outline-none placeholder:text-[#9aa39f]" />
            {query && <button type="button" onClick={() => setQuery("")} aria-label="검색어 지우기" className="grid size-8 shrink-0 place-items-center rounded-full text-[#89938e] hover:bg-white"><X className="size-4" /></button>}
            <button type="submit" disabled={classification.isPending || !query.trim()} className="ml-1 flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-[var(--brand)] px-4 text-[12px] font-extrabold text-white disabled:bg-[#b6c3bd]">{classification.isPending && <LoaderCircle className="size-3.5 animate-spin" />}검색</button>
          </form>
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--line-soft)] pt-3">
            <input ref={galleryInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhoto} className="hidden" />
            <button type="button" onClick={() => setCameraOpen(true)} disabled={preparingPhoto} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--line)] px-3 text-[11px] font-extrabold text-[var(--ink)] hover:bg-[var(--surface-muted)] disabled:opacity-50"><Camera className="size-4 text-[var(--brand-deep)]" />사진 찍기</button>
            <button type="button" onClick={() => galleryInputRef.current?.click()} disabled={preparingPhoto} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--line)] px-3 text-[11px] font-extrabold text-[var(--ink)] hover:bg-[var(--surface-muted)] disabled:opacity-50"><ImagePlus className="size-4 text-[var(--brand-deep)]" />갤러리에서 선택</button>
            {preparingPhoto && <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-[var(--sub)]"><LoaderCircle className="size-3.5 animate-spin" />사진 준비 중</span>}
            {photoError && <p role="alert" className="w-full text-[10px] font-semibold text-rose-600">{photoError}</p>}
          </div>
        </section>

        {!classification.data && !classification.isPending && !classification.isError && (
          <section className="mt-4 overflow-hidden rounded-[18px] border border-[var(--line)] bg-white">
            <div className="border-b border-[var(--line-soft)] px-5 py-4">
              <div className="flex items-center justify-between"><h2 className="flex items-center gap-2 text-[14px] font-extrabold"><History className="size-4 text-[var(--brand)]" />최근 검색</h2>{recentSearches.length > 0 && <button type="button" onClick={clearRecentSearches} className="text-[11px] font-bold text-[var(--faint)]">전체 삭제</button>}</div>
              <div className="mt-3 flex min-h-9 flex-wrap gap-2">
                {recentSearches.length > 0 ? recentSearches.map((item) => <span key={item} className="inline-flex h-9 items-center gap-1 rounded-lg border border-[var(--line)] bg-white pl-3 pr-1.5 text-[12px] font-bold"><button type="button" onClick={() => runSearch(item)}>{item}</button><button type="button" onClick={() => removeRecentSearch(item)} aria-label={`${item} 최근 검색에서 삭제`} className="grid size-6 place-items-center text-[#98a19d]"><X className="size-3" /></button></span>) : <p className="py-2 text-[12px] text-[var(--faint)]">최근 검색어가 없습니다.</p>}
              </div>
            </div>
            <div className="px-5 py-4">
              <h2 className="text-[14px] font-extrabold">검색 가능한 품목</h2>
              <div className="mt-3 flex min-h-9 flex-wrap gap-2">
                {availableItems.isPending && <LoaderCircle className="size-5 animate-spin text-[var(--brand)]" />}
                {availableItems.data?.map((item) => <button key={item.id} type="button" onClick={() => runSearch(item.name)} className="h-9 rounded-lg bg-[var(--surface-muted)] px-3 text-[12px] font-bold text-[var(--ink)] hover:bg-[var(--brand-soft)] hover:text-[var(--brand-deep)]">{item.name}</button>)}
                {availableItems.isError && <p className="text-[12px] text-rose-600">품목 데이터를 불러오지 못했습니다.</p>}
              </div>
            </div>
          </section>
        )}

        {classification.isPending && <div className="mt-4 rounded-[18px] border border-[var(--line)] bg-white p-10 text-center"><LoaderCircle className="mx-auto size-6 animate-spin text-[var(--brand)]" /><p className="mt-3 text-[13px] font-bold">배출 방법을 찾고 있습니다.</p></div>}

        {classification.isError && <div className="mt-4 rounded-[18px] border border-rose-100 bg-white p-10 text-center"><TriangleAlert className="mx-auto size-6 text-rose-500" /><h2 className="mt-3 text-[15px] font-extrabold">검색 결과를 불러오지 못했습니다.</h2><p className="mt-1 text-[12px] text-[var(--sub)]">잠시 후 다시 시도해 주세요.</p><button type="button" onClick={() => classification.reset()} className="mt-4 rounded-lg border border-[var(--line)] px-4 py-2 text-[11px] font-extrabold">돌아가기</button></div>}

        {classification.data && !primaryResult && <div className="mt-4 rounded-[18px] border border-[var(--line)] bg-white p-10 text-center"><Search className="mx-auto size-6 text-[var(--faint)]" /><h2 className="mt-3 text-[15px] font-extrabold">검색 결과가 없습니다.</h2><p className="mt-1 text-[12px] text-[var(--sub)]">다른 이름으로 다시 검색해 보세요.</p><button type="button" onClick={() => classification.reset()} className="mt-4 rounded-lg bg-[var(--brand)] px-4 py-2 text-[11px] font-extrabold text-white">다시 검색</button></div>}

        {classification.data && primaryResult && (
          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
            <section className="overflow-hidden rounded-[18px] border border-[var(--line)] bg-white">
              <div className="flex items-center justify-between border-b border-[var(--line-soft)] px-5 py-4"><h2 className="text-[14px] font-extrabold">배출 방법</h2><button type="button" onClick={() => classification.reset()} className="text-[11px] font-bold text-[var(--sub)]">다른 품목 검색</button></div>
              <div className="divide-y divide-[var(--line-soft)]">
                {classification.data.map((result, index) => {
                  const category = CATEGORY_BY_ID[result.categoryId] ?? CATEGORY_BY_ID.general;
                  return <article key={result.id} className="p-5"><div className="flex items-start gap-3.5"><span className="grid size-10 shrink-0 place-items-center rounded-xl" style={{ color: category.color, backgroundColor: category.softColor }}><CategoryIcon categoryId={category.id} className="size-5" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-[16px] font-extrabold text-[var(--ink)]">{result.displayName}</h3>{index === 0 && <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[var(--brand-deep)]"><CheckCircle2 className="size-3.5" />검색 결과</span>}</div><p className="mt-1 text-[11px] font-bold" style={{ color: category.color }}>{category.label}</p><p className="mt-3 text-[13px] leading-6 text-[var(--sub)]">{result.disposalTip}</p></div></div></article>;
                })}
              </div>
              <div className="border-t border-[var(--line-soft)] bg-[#fafcfb] p-4"><button type="button" onClick={openMap} className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-[var(--brand)] text-[12px] font-extrabold text-white">{CATEGORY_BY_ID[primaryResult.categoryId].shortLabel} 수거함 위치 보기 <ChevronRight className="size-4" /></button><p className="mt-3 text-center text-[10px] text-[var(--faint)]"><Info className="mr-1 inline size-3.5" />지역별 배출 기준이 다를 수 있으니 현장 안내를 함께 확인하세요.</p></div>
            </section>

            <aside className="rounded-[18px] border border-[var(--line)] bg-white p-4">
              <h2 className="mb-3 flex items-center gap-1.5 text-[14px] font-extrabold"><LocateFixed className="size-4 text-[var(--brand-deep)]" />내 위치 근처 수거함</h2>
              <div className="space-y-3">
                {(locationStatus === "idle" || locationStatus === "loading" || (locationStatus === "ready" && relatedFacilities.isPending)) && Array.from({ length: 2 }, (_, index) => <div key={index} className="h-36 animate-pulse rounded-xl bg-[#eef2ef]" />)}
                {locationStatus === "unavailable" && <div className="py-8 text-center"><p className="text-[12px] text-[var(--sub)]">현재 위치를 확인할 수 없습니다.</p><button type="button" onClick={requestCurrentLocation} className="mt-3 rounded-lg border border-[var(--line)] px-3 py-2 text-[11px] font-extrabold text-[var(--brand-deep)]">다시 시도</button></div>}
                {locationStatus === "ready" && relatedFacilities.data?.map((facility) => <FacilityCard key={facility.id} facility={facility} compact />)}
                {locationStatus === "ready" && relatedFacilities.isError && <p className="py-8 text-center text-[12px] text-rose-600">주변 수거함을 불러오지 못했습니다.</p>}
                {locationStatus === "ready" && relatedFacilities.data?.length === 0 && <p className="py-8 text-center text-[12px] text-[var(--sub)]">근처에 등록된 수거함이 없습니다.</p>}
              </div>
            </aside>
          </div>
        )}
      </div>
      </div>
    </>
  );
}
