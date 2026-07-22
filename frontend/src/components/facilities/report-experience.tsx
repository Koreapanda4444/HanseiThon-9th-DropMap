"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock3, LockKeyhole, MapPin, Search, Send, TriangleAlert, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { CategoryIcon } from "@/components/ui/category-icon";
import { PageHeader } from "@/components/ui/page-header";
import { getPrimaryCategory } from "@/config/facility-categories";
import { REPORT_TYPES } from "@/config/reports";
import {
  ApiError,
  fetchCurrentAccount,
  fetchFacilities,
  fetchFacility,
  fetchReports,
  submitReport,
} from "@/lib/api";
import { cn, formatDateTime } from "@/lib/utils";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import type { Facility, ReportType, UserReport } from "@/types/domain";

const STATUS_LABELS: Record<UserReport["status"], string> = {
  received: "접수",
  reviewing: "확인 중",
  resolved: "반영 완료",
};

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : "요청을 처리하지 못했습니다.";
}

function FacilitySearchResult({ facility, onSelect }: { facility: Facility; onSelect: (facility: Facility) => void }) {
  const category = getPrimaryCategory(facility);
  return (
    <button type="button" onClick={() => onSelect(facility)} className="flex w-full items-start gap-3.5 border-t border-[var(--line-soft)] px-4 py-3.5 text-left hover:bg-[#fafcfb]">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl sm:size-11" style={{ color: category.color, backgroundColor: category.softColor }}><CategoryIcon categoryId={category.id} className="size-5 sm:size-[22px]" /></span>
      <span className="min-w-0 flex-1"><strong className="block truncate text-[13px] text-[var(--ink)]">{facility.name}</strong><span className="mt-1 block truncate text-[11px] text-[var(--sub)]">{facility.address}</span></span>
    </button>
  );
}

export function ReportExperience({ initialFacilityId }: { initialFacilityId: string | null }) {
  const queryClient = useQueryClient();
  const accountQuery = useQuery({ queryKey: ["auth", "me"], queryFn: ({ signal }) => fetchCurrentAccount(signal), retry: false, staleTime: 60_000 });
  const [facilitySearch, setFacilitySearch] = useState("");
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null);
  const [linkedFacilityDismissed, setLinkedFacilityDismissed] = useState(false);
  const [reportType, setReportType] = useState<ReportType | null>(null);
  const [content, setContent] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const isAuthenticated = Boolean(accountQuery.data);
  const facilityQueryText = useDebouncedValue(facilitySearch.trim(), 220);
  const facilityResultsReady = facilityQueryText === facilitySearch.trim();

  const linkedFacilityQuery = useQuery({
    queryKey: ["facility", initialFacilityId],
    queryFn: ({ signal }) => fetchFacility(initialFacilityId as string, signal),
    enabled: Boolean(initialFacilityId && !linkedFacilityDismissed),
    retry: false,
  });
  const activeFacility = selectedFacility ?? (!linkedFacilityDismissed ? linkedFacilityQuery.data ?? null : null);

  const facilityResultsQuery = useQuery({
    queryKey: ["report-facilities", facilityQueryText],
    queryFn: ({ signal }) => fetchFacilities({ query: facilityQueryText, limit: 20 }, signal),
    enabled: Boolean(isAuthenticated && !activeFacility && facilityQueryText.length >= 2),
    staleTime: 30_000,
  });
  const reportsQuery = useQuery({
    queryKey: ["reports"],
    queryFn: ({ signal }) => fetchReports(signal),
    enabled: isAuthenticated,
    retry: false,
  });
  const reportMutation = useMutation({
    mutationFn: submitReport,
    onSuccess: () => {
      setContent("");
      setReportType(null);
      setSubmitted(true);
      void queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
  });

  const reports = useMemo(() => isAuthenticated ? reportsQuery.data ?? [] : [], [isAuthenticated, reportsQuery.data]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isAuthenticated || !activeFacility || !reportType || content.trim().length < 5) return;
    setSubmitted(false);
    reportMutation.mutate({ facilityId: activeFacility.id, reportType, content: content.trim() });
  }

  if (accountQuery.isPending) {
    return <div className="mx-auto min-h-[calc(100dvh-138px)] max-w-[1240px] px-4 py-6 sm:px-6 lg:min-h-[calc(100dvh-68px)] lg:py-9"><div className="h-[520px] animate-pulse rounded-[20px] bg-[#edf1ef]" /></div>;
  }

  return (
    <div className="min-h-[calc(100dvh-138px)] px-4 py-5 sm:px-6 lg:min-h-[calc(100dvh-68px)] lg:py-9">
      <div className="mx-auto max-w-[1240px]">
        <PageHeader title="수거함 제보" description="시설의 위치나 상태가 실제와 다르면 알려주세요." />
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_390px] xl:gap-6">
          <form onSubmit={submit} className="rounded-[20px] border border-[var(--line)] bg-white p-5 sm:p-6 lg:p-7 xl:p-8">
            {!isAuthenticated && (
              <div className="mb-6 flex items-center gap-3.5 rounded-2xl border border-[#dce6e1] bg-[#f7faf8] p-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white text-[var(--brand-deep)] shadow-sm"><LockKeyhole className="size-5" /></span>
                <div className="min-w-0 flex-1"><p className="text-[13px] font-extrabold text-[var(--ink)]">로그인 후 제보할 수 있습니다</p><p className="mt-0.5 text-[11px] text-[var(--sub)]">제보 유형과 상세 내용을 확인한 뒤 로그인해 주세요.</p></div>
                <Link href="/more#account" className="shrink-0 rounded-lg bg-[var(--brand)] px-3.5 py-2.5 text-[11px] font-extrabold text-white">로그인</Link>
              </div>
            )}
            <fieldset disabled={!isAuthenticated} className={cn(!isAuthenticated && "[&_button]:cursor-not-allowed [&_input]:cursor-not-allowed [&_textarea]:cursor-not-allowed")}>
            <section>
              <h2 className="text-[15px] font-extrabold text-[var(--ink)]">시설</h2>
              {activeFacility ? (
                <div className="mt-3 flex items-start gap-4 rounded-2xl border border-[var(--line)] bg-[#fafcfb] p-4">
                  <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand-deep)]"><MapPin className="size-6" /></span>
                  <div className="min-w-0 flex-1 pt-0.5"><strong className="block truncate text-[14px] text-[var(--ink)]">{activeFacility.name}</strong><p className="mt-1 truncate text-[12px] text-[var(--sub)]">{activeFacility.address}</p></div>
                  <button type="button" onClick={() => { setSelectedFacility(null); setLinkedFacilityDismissed(true); }} aria-label="시설 다시 선택" className="grid size-9 place-items-center rounded-lg text-[var(--faint)] hover:bg-white hover:text-[var(--ink)]"><X className="size-5" /></button>
                </div>
              ) : (
                <div className="mt-3 overflow-hidden rounded-2xl border border-[var(--line)]">
                  <label className="flex h-13 items-center gap-2.5 px-4"><Search className="size-5 text-[var(--faint)]" /><input value={facilitySearch} onChange={(event) => setFacilitySearch(event.target.value)} maxLength={80} className="min-w-0 flex-1 text-[13px] font-medium outline-none placeholder:text-[var(--faint)]" placeholder="시설명이나 주소 검색" aria-label="제보할 시설 검색" /></label>
                  {facilitySearch.trim().length >= 2 && (!facilityResultsReady || facilityResultsQuery.isPending) && <p className="border-t border-[var(--line-soft)] px-3 py-4 text-[11px] text-[var(--sub)]">검색 중</p>}
                  {facilityResultsReady && facilityResultsQuery.isError && <p className="border-t border-[var(--line-soft)] px-3 py-4 text-[11px] text-rose-600">시설을 불러오지 못했습니다.</p>}
                  {facilityResultsReady && facilityResultsQuery.data?.map((facility) => <FacilitySearchResult key={facility.id} facility={facility} onSelect={(item) => { setSelectedFacility(item); setLinkedFacilityDismissed(true); setFacilitySearch(""); }} />)}
                  {facilityResultsReady && facilityResultsQuery.data?.length === 0 && <p className="border-t border-[var(--line-soft)] px-3 py-4 text-[11px] text-[var(--sub)]">검색 결과가 없습니다.</p>}
                </div>
              )}
            </section>

            <section className="mt-7">
              <h2 className="text-[15px] font-extrabold text-[var(--ink)]">제보 유형</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {REPORT_TYPES.map((item) => {
                  const Icon = item.icon;
                  const selected = reportType === item.id;
                  return (
                    <button key={item.id} type="button" onClick={() => setReportType(item.id)} aria-pressed={selected} className={cn("flex min-h-[86px] items-center gap-3.5 rounded-2xl border p-4 text-left transition", selected ? "border-[var(--brand)] bg-[var(--brand-pale)] shadow-[0_5px_16px_rgba(20,80,57,0.08)]" : "border-[var(--line)] hover:border-[#c9d4ce] hover:bg-[#fafcfb]")}>
                      <span className="grid size-12 shrink-0 place-items-center rounded-xl" style={{ color: item.color, backgroundColor: `${item.color}14` }}><Icon className="size-[23px]" strokeWidth={2.2} /></span>
                      <span className="min-w-0"><strong className="block text-[13px] text-[var(--ink)]">{item.label}</strong><span className="mt-1 block text-[11px] leading-4 text-[var(--sub)]">{item.description}</span></span>
                    </button>
                  );
                })}
              </div>
            </section>

            <label className="mt-7 block text-[15px] font-extrabold text-[var(--ink)]">상세 내용<textarea value={content} onChange={(event) => setContent(event.target.value)} minLength={5} maxLength={1000} required rows={7} className="mt-3 w-full resize-none rounded-2xl border border-[var(--line)] p-4 text-[14px] font-medium leading-6 outline-none focus:border-[var(--brand)]" placeholder="확인이 필요한 내용을 적어주세요." /></label>
            {reportMutation.isError && <p role="alert" className="mt-3 flex items-center gap-1.5 text-[12px] font-semibold text-rose-600"><TriangleAlert className="size-5" />{errorMessage(reportMutation.error)}</p>}
            {submitted && <p role="status" className="mt-3 flex items-center gap-1.5 text-[12px] font-semibold text-[var(--brand-deep)]"><CheckCircle2 className="size-5" />제보가 접수되었습니다.</p>}
            <button type="submit" disabled={!isAuthenticated || !activeFacility || !reportType || content.trim().length < 5 || reportMutation.isPending} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] text-[13px] font-extrabold text-white disabled:bg-[#aebbb5]"><Send className="size-5" />{!isAuthenticated ? "로그인 후 제보 가능" : reportMutation.isPending ? "접수 중" : "제보 접수"}</button>
            </fieldset>
          </form>

          <aside className="h-fit overflow-hidden rounded-[20px] border border-[var(--line)] bg-white lg:sticky lg:top-[92px]">
            <div className="border-b border-[var(--line-soft)] px-5 py-5"><h2 className="text-[15px] font-extrabold text-[var(--ink)]">내 제보</h2></div>
            {!isAuthenticated && <div className="px-5 py-12 text-center"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[var(--surface-muted)] text-[var(--faint)]"><LockKeyhole className="size-7" /></span><p className="mt-3 text-[12px] text-[var(--sub)]">로그인하면 접수한 제보를 확인할 수 있습니다.</p></div>}
            {isAuthenticated && reportsQuery.isPending && <div className="space-y-2 p-4"><div className="h-16 animate-pulse rounded-xl bg-[#f0f3f1]" /><div className="h-16 animate-pulse rounded-xl bg-[#f0f3f1]" /></div>}
            {isAuthenticated && reportsQuery.isError && <p className="px-4 py-8 text-center text-[11px] text-rose-600">제보 내역을 불러오지 못했습니다.</p>}
            {isAuthenticated && !reportsQuery.isPending && !reportsQuery.isError && reports.length === 0 && <p className="px-4 py-10 text-center text-[11px] text-[var(--sub)]">접수한 제보가 없습니다.</p>}
            {reports.map((report) => {
              const type = REPORT_TYPES.find((item) => item.id === report.reportType);
              const ReportIcon = type?.icon;
              return (
                <article key={report.id} className="flex gap-3.5 border-b border-[var(--line-soft)] p-5 last:border-b-0">
                  {ReportIcon && <span className="grid size-11 shrink-0 place-items-center rounded-xl" style={{ color: type.color, backgroundColor: `${type.color}14` }}><ReportIcon className="size-5" /></span>}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2"><strong className="truncate text-[12px] text-[var(--ink)]">{report.facilityName}</strong><span className="shrink-0 rounded-full bg-[var(--brand-soft)] px-2.5 py-1 text-[10px] font-bold text-[var(--brand-deep)]">{STATUS_LABELS[report.status]}</span></div>
                    <p className="mt-1.5 text-[11px] font-semibold text-[var(--sub)]">{type?.label ?? "시설 정보"}</p>
                    <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-[var(--faint)]">{report.content}</p>
                    <p className="mt-2 flex items-center gap-1 text-[10px] text-[var(--faint)]"><Clock3 className="size-3.5" />{formatDateTime(report.createdAt)}</p>
                  </div>
                </article>
              );
            })}
          </aside>
        </div>
      </div>
    </div>
  );
}
