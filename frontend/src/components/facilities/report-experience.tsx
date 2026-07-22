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
    <button type="button" onClick={() => onSelect(facility)} className="flex w-full items-start gap-3 border-t border-[var(--line-soft)] px-3 py-3 text-left hover:bg-[#fafcfb]">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg" style={{ color: category.color, backgroundColor: category.softColor }}><CategoryIcon categoryId={category.id} className="size-4" /></span>
      <span className="min-w-0 flex-1"><strong className="block truncate text-[12px] text-[var(--ink)]">{facility.name}</strong><span className="mt-1 block truncate text-[10px] text-[var(--sub)]">{facility.address}</span></span>
    </button>
  );
}

export function ReportExperience({ initialFacilityId }: { initialFacilityId: string | null }) {
  const queryClient = useQueryClient();
  const accountQuery = useQuery({ queryKey: ["auth", "me"], queryFn: fetchCurrentAccount, retry: false, staleTime: 60_000 });
  const [facilitySearch, setFacilitySearch] = useState("");
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null);
  const [linkedFacilityDismissed, setLinkedFacilityDismissed] = useState(false);
  const [reportType, setReportType] = useState<ReportType | null>(null);
  const [content, setContent] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const linkedFacilityQuery = useQuery({
    queryKey: ["facility", initialFacilityId],
    queryFn: () => fetchFacility(initialFacilityId as string),
    enabled: Boolean(initialFacilityId && accountQuery.data && !linkedFacilityDismissed),
    retry: false,
  });
  const activeFacility = selectedFacility ?? (!linkedFacilityDismissed ? linkedFacilityQuery.data ?? null : null);

  const facilityResultsQuery = useQuery({
    queryKey: ["report-facilities", facilitySearch.trim()],
    queryFn: () => fetchFacilities({ query: facilitySearch.trim(), limit: 20 }),
    enabled: Boolean(accountQuery.data && !activeFacility && facilitySearch.trim().length >= 2),
    staleTime: 30_000,
  });
  const reportsQuery = useQuery({
    queryKey: ["reports"],
    queryFn: fetchReports,
    enabled: Boolean(accountQuery.data),
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

  const reports = useMemo(() => reportsQuery.data ?? [], [reportsQuery.data]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeFacility || !reportType || content.trim().length < 5) return;
    setSubmitted(false);
    reportMutation.mutate({ facilityId: activeFacility.id, reportType, content: content.trim() });
  }

  if (accountQuery.isPending) {
    return <div className="mx-auto min-h-[calc(100dvh-138px)] max-w-[920px] px-4 py-6 sm:px-6 lg:min-h-[calc(100dvh-68px)] lg:py-8"><div className="h-[420px] animate-pulse rounded-2xl bg-[#edf1ef]" /></div>;
  }

  if (!accountQuery.data) {
    return (
      <div className="min-h-[calc(100dvh-138px)] px-4 py-5 sm:px-6 lg:min-h-[calc(100dvh-68px)] lg:py-7">
        <div className="mx-auto max-w-[760px]">
          <PageHeader title="수거함 제보" />
          <section className="mt-4 rounded-2xl border border-[var(--line)] bg-white px-5 py-8 text-center sm:px-8">
            <span className="mx-auto grid size-11 place-items-center rounded-full bg-[var(--brand-soft)] text-[var(--brand-deep)]"><LockKeyhole className="size-5" /></span>
            <h2 className="mt-4 text-[17px] font-extrabold text-[var(--ink)]">로그인이 필요합니다</h2>
            <p className="mt-1.5 text-[12px] text-[var(--sub)]">제보 내용과 처리 상태는 계정에 저장됩니다.</p>
            <Link href="/more#account" className="mt-5 inline-flex h-10 items-center justify-center rounded-lg bg-[var(--brand)] px-5 text-[12px] font-extrabold text-white">로그인 또는 회원가입</Link>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100dvh-138px)] px-4 py-5 sm:px-6 lg:min-h-[calc(100dvh-68px)] lg:py-7">
      <div className="mx-auto max-w-[980px]">
        <PageHeader title="수거함 제보" description="시설의 위치나 상태가 실제와 다르면 알려주세요." />
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <form onSubmit={submit} className="rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6">
            <section>
              <h2 className="text-[13px] font-extrabold text-[var(--ink)]">시설</h2>
              {activeFacility ? (
                <div className="mt-3 flex items-start gap-3 rounded-xl border border-[var(--line)] bg-[#fafcfb] p-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand-deep)]"><MapPin className="size-[18px]" /></span>
                  <div className="min-w-0 flex-1"><strong className="block truncate text-[12px] text-[var(--ink)]">{activeFacility.name}</strong><p className="mt-1 truncate text-[10px] text-[var(--sub)]">{activeFacility.address}</p></div>
                  <button type="button" onClick={() => { setSelectedFacility(null); setLinkedFacilityDismissed(true); }} aria-label="시설 다시 선택" className="grid size-8 place-items-center rounded-lg text-[var(--faint)] hover:bg-white hover:text-[var(--ink)]"><X className="size-4" /></button>
                </div>
              ) : (
                <div className="mt-3 overflow-hidden rounded-xl border border-[var(--line)]">
                  <label className="flex h-11 items-center gap-2 px-3"><Search className="size-4 text-[var(--faint)]" /><input value={facilitySearch} onChange={(event) => setFacilitySearch(event.target.value)} className="min-w-0 flex-1 text-[12px] font-medium outline-none placeholder:text-[var(--faint)]" placeholder="시설명이나 주소 검색" aria-label="제보할 시설 검색" /></label>
                  {facilityResultsQuery.isPending && facilitySearch.trim().length >= 2 && <p className="border-t border-[var(--line-soft)] px-3 py-4 text-[11px] text-[var(--sub)]">검색 중</p>}
                  {facilityResultsQuery.isError && <p className="border-t border-[var(--line-soft)] px-3 py-4 text-[11px] text-rose-600">시설을 불러오지 못했습니다.</p>}
                  {facilityResultsQuery.data?.map((facility) => <FacilitySearchResult key={facility.id} facility={facility} onSelect={(item) => { setSelectedFacility(item); setLinkedFacilityDismissed(true); setFacilitySearch(""); }} />)}
                  {facilityResultsQuery.data?.length === 0 && <p className="border-t border-[var(--line-soft)] px-3 py-4 text-[11px] text-[var(--sub)]">검색 결과가 없습니다.</p>}
                </div>
              )}
            </section>

            <section className="mt-6">
              <h2 className="text-[13px] font-extrabold text-[var(--ink)]">제보 유형</h2>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {REPORT_TYPES.map((item) => {
                  const Icon = item.icon;
                  const selected = reportType === item.id;
                  return (
                    <button key={item.id} type="button" onClick={() => setReportType(item.id)} aria-pressed={selected} className={cn("flex items-center gap-3 rounded-xl border p-3 text-left transition", selected ? "border-[var(--brand)] bg-[var(--brand-pale)]" : "border-[var(--line)] hover:bg-[#fafcfb]")}>
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white" style={{ color: item.color }}><Icon className="size-4" /></span>
                      <span className="min-w-0"><strong className="block text-[11px] text-[var(--ink)]">{item.label}</strong><span className="mt-0.5 block truncate text-[9px] text-[var(--sub)]">{item.description}</span></span>
                    </button>
                  );
                })}
              </div>
            </section>

            <label className="mt-6 block text-[13px] font-extrabold text-[var(--ink)]">상세 내용<textarea value={content} onChange={(event) => setContent(event.target.value)} minLength={5} maxLength={1000} required rows={5} className="mt-3 w-full resize-none rounded-xl border border-[var(--line)] p-3 text-[12px] font-medium leading-5 outline-none focus:border-[var(--brand)]" placeholder="확인이 필요한 내용을 적어주세요." /></label>
            {reportMutation.isError && <p role="alert" className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-rose-600"><TriangleAlert className="size-4" />{errorMessage(reportMutation.error)}</p>}
            {submitted && <p role="status" className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-[var(--brand-deep)]"><CheckCircle2 className="size-4" />제보가 접수되었습니다.</p>}
            <button type="submit" disabled={!activeFacility || !reportType || content.trim().length < 5 || reportMutation.isPending} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[var(--brand)] text-[12px] font-extrabold text-white disabled:bg-[#aebbb5]"><Send className="size-4" />{reportMutation.isPending ? "접수 중" : "제보 접수"}</button>
          </form>

          <aside className="h-fit overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
            <div className="border-b border-[var(--line-soft)] px-4 py-4"><h2 className="text-[13px] font-extrabold text-[var(--ink)]">내 제보</h2></div>
            {reportsQuery.isPending && <div className="space-y-2 p-4"><div className="h-16 animate-pulse rounded-xl bg-[#f0f3f1]" /><div className="h-16 animate-pulse rounded-xl bg-[#f0f3f1]" /></div>}
            {reportsQuery.isError && <p className="px-4 py-8 text-center text-[11px] text-rose-600">제보 내역을 불러오지 못했습니다.</p>}
            {!reportsQuery.isPending && !reportsQuery.isError && reports.length === 0 && <p className="px-4 py-10 text-center text-[11px] text-[var(--sub)]">접수한 제보가 없습니다.</p>}
            {reports.map((report) => {
              const type = REPORT_TYPES.find((item) => item.id === report.reportType);
              return (
                <article key={report.id} className="border-b border-[var(--line-soft)] p-4 last:border-b-0">
                  <div className="flex items-center justify-between gap-2"><strong className="truncate text-[11px] text-[var(--ink)]">{report.facilityName}</strong><span className="shrink-0 rounded-full bg-[var(--brand-soft)] px-2 py-1 text-[9px] font-bold text-[var(--brand-deep)]">{STATUS_LABELS[report.status]}</span></div>
                  <p className="mt-1.5 text-[10px] font-semibold text-[var(--sub)]">{type?.label ?? "시설 정보"}</p>
                  <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-[var(--faint)]">{report.content}</p>
                  <p className="mt-2 flex items-center gap-1 text-[9px] text-[var(--faint)]"><Clock3 className="size-3" />{formatDateTime(report.createdAt)}</p>
                </article>
              );
            })}
          </aside>
        </div>
      </div>
    </div>
  );
}
