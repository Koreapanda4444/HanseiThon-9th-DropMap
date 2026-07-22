"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Camera, Check, ChevronRight, History, Info, LoaderCircle, Search, Sparkles, TriangleAlert, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { FacilityCard } from "@/components/facilities/facility-card";
import { CategoryIcon } from "@/components/ui/category-icon";
import { PageHeader } from "@/components/ui/page-header";
import { CATEGORY_BY_ID } from "@/config/facility-categories";
import { classifyWaste, fetchFacilities, fetchWasteItems } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/use-app-store";

export function SearchExperience({ initialQuery = "" }: { initialQuery?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [photoNotice, setPhotoNotice] = useState(false);
  const initialSearchDone = useRef(false);
  const recentSearches = useAppStore((state) => state.recentSearches);
  const addRecentSearch = useAppStore((state) => state.addRecentSearch);
  const removeRecentSearch = useAppStore((state) => state.removeRecentSearch);
  const clearRecentSearches = useAppStore((state) => state.clearRecentSearches);
  const setSelectedCategoryId = useAppStore((state) => state.setSelectedCategoryId);
  const classification = useMutation({ mutationFn: classifyWaste });
  const availableItems = useQuery({ queryKey: ["waste-items"], queryFn: fetchWasteItems });
  const primaryResult = classification.data?.[0];
  const relatedFacilities = useQuery({
    queryKey: ["related-facilities", primaryResult?.categoryId],
    queryFn: () => fetchFacilities({ categoryId: primaryResult?.categoryId, limit: 2 }),
    enabled: Boolean(primaryResult),
  });

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

  return (
    <div className="min-h-[calc(100dvh-138px)] bg-[var(--app-bg)] px-4 py-6 sm:px-6 lg:min-h-[calc(100dvh-68px)] lg:py-10">
      <div className="mx-auto max-w-[1100px]">
        <PageHeader title="버리는 방법 찾기" description="등록된 품목명이나 별칭으로 배출 방법과 수거함을 찾아보세요." />

        <section className="relative mt-6 overflow-hidden rounded-[28px] bg-[#12392f] px-5 py-7 text-white shadow-[0_18px_50px_rgba(18,57,47,0.18)] sm:px-8 sm:py-9 lg:px-10">
          <div className="absolute -right-14 -top-16 size-56 rounded-full bg-[#26b882]/20 blur-2xl" />
          <div className="absolute -bottom-24 left-[30%] size-52 rounded-full bg-[#83e0bb]/10 blur-2xl" />
          <div className="relative z-10 max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-bold text-[#bcebd8]"><Sparkles className="size-3.5" /> 배출 품목 데이터 검색</div>
            <h2 className="text-[22px] font-black tracking-[-0.04em] sm:text-[27px]">버릴 물건의 이름을 입력해 주세요</h2>
            <p className="mt-2 text-[13px] leading-6 text-white/65 sm:text-sm">Oracle에 등록된 품목과 별칭을 비교해 알맞은 수거함 종류를 찾습니다.</p>
            <form onSubmit={handleSubmit} className="mt-6 flex min-h-[58px] items-center gap-2 rounded-[19px] bg-white p-2 pl-4 shadow-xl">
              <Search className="size-5 shrink-0 text-[#6f7d77]" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="버릴 물건을 입력해 주세요" aria-label="버릴 물건 입력" className="h-11 min-w-0 flex-1 bg-transparent px-1 text-[14px] font-semibold text-[var(--ink)] outline-none placeholder:text-[#9ba5a0] sm:text-[15px]" />
              {query && <button type="button" aria-label="검색어 지우기" onClick={() => setQuery("")} className="grid size-9 shrink-0 place-items-center rounded-full text-[#8d9893] hover:bg-[#f2f5f3]"><X className="size-4" /></button>}
              <button type="submit" aria-label="분류하기" disabled={classification.isPending || !query.trim()} className="flex h-11 shrink-0 items-center gap-2 rounded-[14px] bg-[var(--brand)] px-4 text-[13px] font-extrabold text-white transition hover:bg-[var(--brand-deep)] disabled:cursor-not-allowed disabled:opacity-50 sm:px-5">
                {classification.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <Search className="size-4" />}
                <span className="hidden sm:inline">찾기</span>
              </button>
            </form>
            <button type="button" onClick={() => { setPhotoNotice(true); window.setTimeout(() => setPhotoNotice(false), 2500); }} className="mt-3 inline-flex items-center gap-2 text-[12px] font-bold text-white/65 hover:text-white"><Camera className="size-4" /> 사진 검색은 준비 중이에요</button>
          </div>
        </section>

        {photoNotice && <div role="status" className="fixed bottom-24 left-1/2 z-[70] -translate-x-1/2 rounded-full bg-[var(--ink)] px-4 py-2.5 text-[12px] font-bold text-white shadow-xl lg:bottom-8">현재는 텍스트 품목 검색을 이용해 주세요.</div>}

        {!classification.data && !classification.isPending && !classification.isError && (
          <div className="mt-7 grid gap-5 lg:grid-cols-2">
            <section className="rounded-[24px] border border-[var(--line)] bg-white p-5 sm:p-6">
              <div className="flex items-center justify-between"><h2 className="flex items-center gap-2 text-[16px] font-black tracking-[-0.03em]"><History className="size-[18px] text-[var(--brand)]" /> 최근 검색</h2>{recentSearches.length > 0 && <button type="button" onClick={clearRecentSearches} className="text-[12px] font-bold text-[var(--faint)] hover:text-[var(--ink)]">전체 삭제</button>}</div>
              <div className="mt-4 space-y-1">
                {recentSearches.length > 0 ? recentSearches.map((item) => <div key={item} className="flex items-center gap-2 rounded-xl px-2 py-2.5 hover:bg-[var(--surface-muted)]"><button type="button" onClick={() => runSearch(item)} className="min-w-0 flex-1 truncate text-left text-[14px] font-semibold text-[var(--ink)]">{item}</button><button type="button" onClick={() => removeRecentSearch(item)} aria-label={`${item} 최근 검색에서 삭제`} className="grid size-7 place-items-center rounded-full text-[#9aa49f] hover:bg-white hover:text-[var(--ink)]"><X className="size-3.5" /></button></div>) : <p className="py-8 text-center text-[13px] text-[var(--faint)]">최근 검색어가 없어요.</p>}
              </div>
            </section>

            <section className="rounded-[24px] border border-[var(--line)] bg-white p-5 sm:p-6">
              <h2 className="flex items-center gap-2 text-[16px] font-black tracking-[-0.03em]"><Sparkles className="size-[18px] text-amber-500" /> 검색 가능한 품목</h2>
              <div className="mt-4 flex min-h-10 flex-wrap gap-2">
                {availableItems.isPending && <LoaderCircle className="size-5 animate-spin text-[var(--brand)]" />}
                {availableItems.data?.map((item) => <button key={item.id} type="button" onClick={() => runSearch(item.name)} className="inline-flex h-10 items-center rounded-full border border-[var(--line)] bg-white px-3.5 text-[13px] font-bold text-[var(--ink)] transition hover:border-[var(--brand)] hover:bg-[var(--brand-soft)] hover:text-[var(--brand-deep)]">{item.name}</button>)}
                {availableItems.isError && <p className="text-[12px] text-rose-600">품목 데이터를 불러오지 못했습니다.</p>}
                {availableItems.data?.length === 0 && <p className="text-[12px] text-[var(--faint)]">등록된 품목이 없습니다.</p>}
              </div>
              <div className="mt-5 rounded-2xl bg-[#f4f8f6] p-4 text-[12px] leading-5 text-[var(--sub)]"><Info className="mr-1 inline size-4 text-[var(--brand)]" /> 실제 배출 전 제품의 분리배출 표시와 지자체 안내도 확인해 주세요.</div>
            </section>
          </div>
        )}

        {classification.isPending && <div className="mt-7 rounded-[26px] border border-[var(--line)] bg-white p-8 text-center"><LoaderCircle className="mx-auto size-8 animate-spin text-[var(--brand)]" /><p className="mt-3 text-[14px] font-bold">품목 데이터에서 배출 방법을 찾고 있어요.</p></div>}

        {classification.isError && <div className="mt-7 rounded-[26px] border border-rose-100 bg-white p-8 text-center"><TriangleAlert className="mx-auto size-7 text-rose-500" /><h2 className="mt-3 text-[16px] font-black">검색 요청을 처리하지 못했습니다.</h2><p className="mt-1 text-[12px] text-[var(--sub)]">API와 Oracle 연결 상태를 확인한 뒤 다시 시도해 주세요.</p><button type="button" onClick={() => classification.reset()} className="mt-4 rounded-xl border border-[var(--line)] px-4 py-2 text-[12px] font-extrabold">검색 화면으로</button></div>}

        {classification.data && !primaryResult && <div className="mt-7 rounded-[26px] border border-[var(--line)] bg-white p-9 text-center"><Search className="mx-auto size-7 text-[var(--faint)]" /><h2 className="mt-3 text-[17px] font-black">일치하는 품목이 없습니다.</h2><p className="mt-1 text-[12px] text-[var(--sub)]">Oracle 품목 사전에 이름이나 별칭을 먼저 등록해 주세요.</p><button type="button" onClick={() => classification.reset()} className="mt-4 rounded-xl bg-[var(--brand)] px-4 py-2.5 text-[12px] font-extrabold text-white">다시 검색</button></div>}

        {classification.data && primaryResult && (
          <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
            <section>
              <div className="mb-3 flex items-center justify-between"><h2 className="text-[18px] font-black tracking-[-0.03em]">분류 결과</h2><button type="button" onClick={() => classification.reset()} className="text-[12px] font-bold text-[var(--sub)]">다시 검색</button></div>
              <div className="space-y-3">
                {classification.data.map((result, index) => {
                  const category = CATEGORY_BY_ID[result.categoryId] ?? CATEGORY_BY_ID.general;
                  return <article key={result.id} className={cn("rounded-[24px] border bg-white p-5 shadow-sm sm:p-6", index === 0 ? "border-[var(--brand)] ring-1 ring-[var(--brand)]/10" : "border-[var(--line)]")}><div className="flex items-start gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-2xl" style={{ color: category.color, backgroundColor: category.softColor }}><CategoryIcon categoryId={category.id} className="size-6" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-[17px] font-black tracking-[-0.025em]">{result.displayName}</h3>{index === 0 && <span className="inline-flex items-center gap-1 rounded-full bg-[var(--brand-soft)] px-2 py-1 text-[10px] font-extrabold text-[var(--brand-deep)]"><Check className="size-3" /> 우선 결과</span>}</div><p className="mt-1 text-[12px] font-bold" style={{ color: category.color }}>{category.label} · 일치도 {Math.round(result.confidence * 100)}%</p><p className="mt-3 text-[13px] leading-6 text-[var(--sub)]">{result.disposalTip}</p></div></div></article>;
                })}
              </div>
              <button type="button" onClick={openMap} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--brand)] text-[13px] font-extrabold text-white">{CATEGORY_BY_ID[primaryResult.categoryId].shortLabel} 수거함 지도에서 보기 <ChevronRight className="size-4" /></button>
            </section>

            <aside>
              <h2 className="mb-3 text-[16px] font-black tracking-[-0.03em]">관련 수거함</h2>
              <div className="space-y-3">
                {relatedFacilities.isPending && Array.from({ length: 2 }, (_, index) => <div key={index} className="h-48 animate-pulse rounded-[22px] bg-[#eef2ef]" />)}
                {relatedFacilities.data?.map((facility) => <FacilityCard key={facility.id} facility={facility} compact />)}
                {relatedFacilities.isError && <div className="rounded-[22px] border border-rose-100 bg-white p-5 text-[12px] text-rose-600">관련 시설을 불러오지 못했습니다.</div>}
                {relatedFacilities.data?.length === 0 && <div className="rounded-[22px] border border-[var(--line)] bg-white p-5 text-[12px] text-[var(--sub)]">해당 종류로 등록된 수거함이 없습니다.</div>}
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
