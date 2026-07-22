"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Camera, Check, ChevronLeft, ChevronRight, LoaderCircle, MapPinned, Pencil, RotateCcw, TriangleAlert, X } from "lucide-react";
import { useRef, useState, type KeyboardEvent } from "react";
import { CategoryIcon } from "@/components/ui/category-icon";
import { CATEGORY_BY_ID } from "@/config/facility-categories";
import { analyzeImage, ApiError, classifyWaste } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { FacilityCategoryId, ImageAnalysisItem } from "@/types/domain";

export interface PreparedImage {
  id: string;
  dataUrl: string;
  previewUrl: string;
  width: number;
  height: number;
}

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : "사진을 분석하지 못했습니다.";
}

export function PhotoAnalysisFlow({ image, onClose, onRetake, onOpenMap }: {
  image: PreparedImage;
  onClose: () => void;
  onRetake: () => void;
  onOpenMap: (categoryId: FacilityCategoryId) => void;
}) {
  const analysis = useQuery({
    queryKey: ["image-analysis", image.id],
    queryFn: ({ signal }) => analyzeImage(image.dataUrl, signal),
    retry: false,
    staleTime: Infinity,
  });
  const [editedItems, setEditedItems] = useState<ImageAnalysisItem[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [phase, setPhase] = useState<"review" | "guide">("review");
  const lastTapRef = useRef<{ id: string; at: number } | null>(null);
  const correctionVersionRef = useRef(new Map<string, number>());

  const items = editedItems ?? analysis.data ?? [];
  const selected = items.find((item) => item.id === selectedId) ?? items[0] ?? null;
  const correction = useMutation({
    mutationFn: async ({ itemId, name, version }: { itemId: string; name: string; version: number }) => ({ itemId, version, results: await classifyWaste(name) }),
    onSuccess: ({ itemId, version, results }) => {
      if (correctionVersionRef.current.get(itemId) !== version) return;
      const result = results[0];
      if (!result) return;
      setEditedItems((current) => (current ?? analysis.data ?? []).map((item) => item.id === itemId ? { ...item, categoryId: result.categoryId, confidence: result.confidence, disposalTip: result.disposalTip } : item));
    },
  });

  function beginEditing(item: ImageAnalysisItem) {
    setSelectedId(item.id);
    setEditingId(item.id);
    setEditingValue(item.name);
  }

  function selectItem(item: ImageAnalysisItem, eventTime: number) {
    const previous = lastTapRef.current;
    setSelectedId(item.id);
    if (previous?.id === item.id && eventTime - previous.at < 380) beginEditing(item);
    lastTapRef.current = { id: item.id, at: eventTime };
  }

  function saveName(itemId: string) {
    const nextName = editingValue.trim();
    if (nextName) {
      setEditedItems(items.map((item) => item.id === itemId ? { ...item, name: nextName } : item));
      const version = (correctionVersionRef.current.get(itemId) ?? 0) + 1;
      correctionVersionRef.current.set(itemId, version);
      correction.mutate({ itemId, name: nextName, version });
    }
    setEditingId(null);
    setEditingValue("");
  }

  function handleEditKey(event: KeyboardEvent<HTMLInputElement>, itemId: string) {
    if (event.key === "Enter") saveName(itemId);
    if (event.key === "Escape") {
      setEditingId(null);
      setEditingValue("");
    }
  }

  if (phase === "guide") {
    return (
      <div className="min-h-[calc(100dvh-138px)] bg-[var(--app-bg)] lg:min-h-[calc(100dvh-68px)]">
        <header className="border-b border-[var(--line)] bg-white px-4 py-3 sm:px-6"><div className="mx-auto flex max-w-[1080px] items-center gap-3"><button type="button" onClick={() => setPhase("review")} className="grid size-9 place-items-center rounded-full bg-[var(--surface-muted)]" aria-label="사진 확인으로 돌아가기"><ArrowLeft className="size-4.5" /></button><div><p className="text-[10px] font-bold text-[var(--brand-deep)]">분석 결과</p><h1 className="text-[15px] font-extrabold text-[var(--ink)]">물품별 배출 방법</h1></div></div></header>
        <main className="mx-auto grid max-w-[1080px] gap-4 px-4 py-5 sm:px-6 lg:grid-cols-[360px_minmax(0,1fr)] lg:py-7">
          <div className="h-fit overflow-hidden rounded-2xl border border-[var(--line)] bg-[#222] p-3"><div className="w-full bg-contain bg-center bg-no-repeat" style={{ aspectRatio: `${image.width} / ${image.height}`, backgroundImage: `url(${JSON.stringify(image.previewUrl)})` }} /></div>
          <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
            <div className="border-b border-[var(--line-soft)] px-5 py-4"><h2 className="text-[13px] font-extrabold">확인된 물품 {items.length}개</h2></div>
            <div className="divide-y divide-[var(--line-soft)]">
              {items.map((item) => {
                const category = CATEGORY_BY_ID[item.categoryId];
                return <article key={item.id} className="p-5"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl" style={{ color: category.color, backgroundColor: category.softColor }}><CategoryIcon categoryId={category.id} className="size-5" /></span><div className="min-w-0 flex-1"><h3 className="text-[14px] font-extrabold text-[var(--ink)]">{item.name}</h3><p className="mt-1 text-[10px] font-bold" style={{ color: category.color }}>{category.label}</p><p className="mt-3 text-[12px] leading-5 text-[var(--sub)]">{item.disposalTip}</p><button type="button" onClick={() => onOpenMap(item.categoryId)} className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--line)] px-3 text-[10px] font-extrabold text-[var(--brand-deep)]"><MapPinned className="size-3.5" />수거함 지도 보기</button></div></div></article>;
              })}
            </div>
            <div className="border-t border-[var(--line-soft)] p-4"><button type="button" onClick={onClose} className="h-10 w-full rounded-lg bg-[var(--brand)] text-[11px] font-extrabold text-white">품목 검색으로 돌아가기</button></div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100dvh-138px)] bg-[#171b19] lg:min-h-[calc(100dvh-68px)]">
      <header className="flex h-14 items-center gap-3 border-b border-white/10 bg-[#202522] px-4 text-white sm:px-5">
        <button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-full bg-white/10" aria-label="사진 분석 닫기"><X className="size-4.5" /></button>
        <div className="min-w-0"><h1 className="text-[13px] font-extrabold">사진에서 물품 확인</h1><p className="mt-0.5 text-[9px] text-white/55">목록을 두 번 누르면 물품명을 수정할 수 있습니다.</p></div>
      </header>

      <main className="relative min-h-[calc(100dvh-194px)] overflow-hidden lg:min-h-[calc(100dvh-122px)]">
        <div className="absolute inset-0 bottom-[76px] grid place-items-center overflow-auto p-4 sm:p-6">
          <div className="relative w-full max-w-[900px] overflow-hidden rounded-lg bg-black shadow-2xl" style={{ aspectRatio: `${image.width} / ${image.height}`, maxHeight: "calc(100dvh - 230px)" }}>
            <div className="absolute inset-0 bg-contain bg-center bg-no-repeat" role="img" aria-label="분석할 물품 사진" style={{ backgroundImage: `url(${JSON.stringify(image.previewUrl)})` }} />
            {selected && <span className="pointer-events-none absolute border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.45),0_0_12px_rgba(255,255,255,0.45)]" style={{ left: `${selected.boundingBox.x}%`, top: `${selected.boundingBox.y}%`, width: `${selected.boundingBox.width}%`, height: `${selected.boundingBox.height}%` }}><span className="absolute -top-6 left-0 rounded bg-black/70 px-1.5 py-1 text-[9px] font-bold text-white">{selected.name}</span></span>}
          </div>
        </div>

        {analysis.isPending && <div className="absolute left-1/2 top-5 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/70 px-4 py-2 text-[10px] font-bold text-white"><LoaderCircle className="size-4 animate-spin" />사진을 분석하고 있습니다</div>}
        {analysis.isError && <div className="absolute left-1/2 top-5 z-10 w-[min(90%,360px)] -translate-x-1/2 rounded-xl bg-white p-4 text-center shadow-xl"><TriangleAlert className="mx-auto size-5 text-rose-500" /><p className="mt-2 text-[11px] font-bold text-[var(--ink)]">{errorMessage(analysis.error)}</p><button type="button" onClick={() => analysis.refetch()} className="mt-3 h-8 rounded-lg border border-[var(--line)] px-3 text-[10px] font-extrabold">다시 분석</button></div>}

        <aside className={cn("absolute bottom-[76px] right-0 top-0 z-20 w-[min(86vw,360px)] border-l border-white/10 bg-[#f8faf9] shadow-[-12px_0_32px_rgba(0,0,0,0.28)] transition-transform duration-300", panelOpen ? "translate-x-0" : "translate-x-full")}>
          <button type="button" onClick={() => setPanelOpen((open) => !open)} className="absolute left-0 top-1/2 flex h-14 w-11 -translate-x-full -translate-y-1/2 items-center justify-center rounded-l-xl bg-white text-[var(--ink)] shadow-[-5px_3px_14px_rgba(0,0,0,0.18)]" aria-label={panelOpen ? "분석 목록 닫기" : "분석 목록 열기"}>{panelOpen ? <ChevronRight className="size-5" /> : <ChevronLeft className="size-5" />}{!panelOpen && items.length > 0 && <span className="absolute -top-2 left-1/2 grid size-5 -translate-x-1/2 place-items-center rounded-full bg-[var(--brand)] text-[9px] font-extrabold text-white">{items.length}</span>}</button>
          <div className="flex h-13 items-center justify-between border-b border-[var(--line)] px-4"><div><h2 className="text-[12px] font-extrabold text-[var(--ink)]">인식된 물품</h2><p className="mt-0.5 text-[9px] text-[var(--sub)]">선택하면 사진에서 위치를 표시합니다.</p></div></div>
          <div className="no-scrollbar h-[calc(100%-52px)] overflow-y-auto p-3">
            {!analysis.isPending && !analysis.isError && items.length === 0 && <p className="px-3 py-12 text-center text-[11px] text-[var(--sub)]">확인된 물품이 없습니다.</p>}
            <div className="space-y-2">
              {items.map((item) => {
                const category = CATEGORY_BY_ID[item.categoryId];
                const active = selected?.id === item.id;
                return (
                  <div key={item.id} role="button" tabIndex={0} aria-pressed={active} onClick={(event) => selectItem(item, event.timeStamp)} onDoubleClick={() => beginEditing(item)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectItem(item, event.timeStamp); } }} className={cn("flex cursor-pointer items-center gap-3 rounded-xl border bg-white p-3 outline-none transition", active ? "border-[var(--brand)] shadow-sm" : "border-[var(--line)] hover:border-[#c7d2cc]")}>
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg" style={{ color: category.color, backgroundColor: category.softColor }}><CategoryIcon categoryId={category.id} className="size-4.5" /></span>
                    <div className="min-w-0 flex-1">
                      {editingId === item.id ? <div className="flex items-center gap-1.5" onClick={(event) => event.stopPropagation()}><input value={editingValue} onChange={(event) => setEditingValue(event.target.value)} onBlur={() => saveName(item.id)} onKeyDown={(event) => handleEditKey(event, item.id)} autoFocus maxLength={80} className="h-8 min-w-0 flex-1 rounded-lg border border-[var(--brand)] px-2 text-[11px] font-bold outline-none" /><button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => saveName(item.id)} className="grid size-8 place-items-center rounded-lg bg-[var(--brand)] text-white"><Check className="size-3.5" /></button></div> : <><div className="flex items-center gap-1.5"><strong className="truncate text-[11px] text-[var(--ink)]">{item.name}</strong><Pencil className="size-3 shrink-0 text-[var(--faint)]" /></div><p className="mt-1 text-[9px] font-bold" style={{ color: category.color }}>{category.shortLabel} · {Math.round(item.confidence * 100)}%</p></>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

        <footer className="absolute inset-x-0 bottom-0 z-30 flex h-[76px] items-center justify-center gap-2 border-t border-white/10 bg-[#202522] px-4">
          <button type="button" onClick={onRetake} className="flex h-11 min-w-[118px] items-center justify-center gap-2 rounded-xl border border-white/20 px-4 text-[11px] font-extrabold text-white"><RotateCcw className="size-4" />다시 찍기</button>
          <button type="button" onClick={() => setPhase("guide")} disabled={analysis.isPending || items.length === 0} className="flex h-11 min-w-[148px] items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-5 text-[11px] font-extrabold text-white disabled:bg-[#58645f]"><Camera className="size-4" />다음<ChevronRight className="size-4" /></button>
        </footer>
      </main>
    </div>
  );
}
