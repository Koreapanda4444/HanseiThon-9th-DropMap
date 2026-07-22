"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, ChevronRight, History, Info, LoaderCircle, Search, TriangleAlert, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { FacilityCard } from "@/components/facilities/facility-card";
import { CategoryIcon } from "@/components/ui/category-icon";
import { PageHeader } from "@/components/ui/page-header";
import { CATEGORY_BY_ID } from "@/config/facility-categories";
import { classifyWaste, fetchFacilities, fetchWasteItems } from "@/lib/api";
import { useAppStore } from "@/store/use-app-store";

export function SearchExperience({ initialQuery = "" }: { initialQuery?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
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
    queryFn: () => fetchFacilities({ categoryId: primaryResult?.categoryId, limit: 3 }),
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
    <div className="min-h-[calc(100dvh-138px)] bg-[var(--app-bg)] px-4 py-6 sm:px-6 lg:min-h-[calc(100dvh-68px)] lg:py-9">
      <div className="mx-auto max-w-[1040px]">
        <PageHeader title="품목 검색" description="버릴 물건의 이름으로 배출 방법과 수거 장소를 확인하세요." />

        <section className="mt-5 rounded-[18px] border border-[var(--line)] bg-white p-3 sm:p-4">
          <form onSubmit={handleSubmit} className="flex h-13 items-center rounded-xl border border-[#d9e0dc] bg-[#f8faf9] px-3 transition focus-within:border-[var(--brand)] focus-within:bg-white focus-within:ring-3 focus-within:ring-[var(--brand)]/10">
            <Search className="size-5 shrink-0 text-[#68746e]" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="예: 보조배터리, 형광등, 감기약" aria-label="버릴 품목 검색" className="h-full min-w-0 flex-1 bg-transparent px-3 text-[14px] font-semibold text-[var(--ink)] outline-none placeholder:text-[#9aa39f]" />
            {query && <button type="button" onClick={() => setQuery("")} aria-label="검색어 지우기" className="grid size-8 shrink-0 place-items-center rounded-full text-[#89938e] hover:bg-white"><X className="size-4" /></button>}
            <button type="submit" disabled={classification.isPending || !query.trim()} className="ml-1 flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-[var(--brand)] px-4 text-[12px] font-extrabold text-white disabled:bg-[#b6c3bd]">{classification.isPending && <LoaderCircle className="size-3.5 animate-spin" />}검색</button>
          </form>
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
              <h2 className="mb-3 text-[14px] font-extrabold">관련 수거함</h2>
              <div className="space-y-3">
                {relatedFacilities.isPending && Array.from({ length: 2 }, (_, index) => <div key={index} className="h-36 animate-pulse rounded-xl bg-[#eef2ef]" />)}
                {relatedFacilities.data?.map((facility) => <FacilityCard key={facility.id} facility={facility} compact />)}
                {relatedFacilities.isError && <p className="py-8 text-center text-[12px] text-rose-600">관련 시설을 불러오지 못했습니다.</p>}
                {relatedFacilities.data?.length === 0 && <p className="py-8 text-center text-[12px] text-[var(--sub)]">등록된 수거함이 없습니다.</p>}
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
