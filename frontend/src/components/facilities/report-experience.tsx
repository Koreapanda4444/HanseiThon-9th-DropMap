"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Check, ChevronRight, CircleDot, Clock3, ImagePlus, LoaderCircle, MapPin, Send, ShieldCheck, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { REPORT_STATUS_LABELS, REPORT_TYPE_BY_ID, REPORT_TYPES } from "@/config/reports";
import { fetchFacilities, fetchReports, reportSchema, submitReport } from "@/lib/api";
import { getOrCreateDeviceId } from "@/lib/device";
import { cn, formatDateTime } from "@/lib/utils";
import type { ReportType } from "@/types/domain";

export function ReportExperience({ initialFacilityId = "" }: { initialFacilityId?: string }) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"new" | "history">("new");
  const [facilityId, setFacilityId] = useState(initialFacilityId);
  const [type, setType] = useState<ReportType>("full");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [deviceId, setDeviceId] = useState<string | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDeviceId(getOrCreateDeviceId()), 0);
    return () => window.clearTimeout(timeout);
  }, []);

  const facilitiesQuery = useQuery({
    queryKey: ["facilities", "report"],
    queryFn: () => fetchFacilities({ limit: 200 }),
  });
  const facilities = useMemo(() => facilitiesQuery.data ?? [], [facilitiesQuery.data]);
  const effectiveFacilityId = useMemo(() => {
    if (facilityId && facilities.some((facility) => facility.id === facilityId)) return facilityId;
    if (initialFacilityId && facilities.some((facility) => facility.id === initialFacilityId)) return initialFacilityId;
    return facilities[0]?.id ?? "";
  }, [facilities, facilityId, initialFacilityId]);
  const reportsQuery = useQuery({
    queryKey: ["reports", deviceId],
    queryFn: () => fetchReports(deviceId as string),
    enabled: Boolean(deviceId) && activeTab === "history",
  });
  const reportMutation = useMutation({
    mutationFn: submitReport,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["reports", deviceId] });
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!deviceId) {
      setError("기기 식별 정보를 준비하지 못했습니다.");
      return;
    }
    const result = reportSchema.safeParse({ facilityId: effectiveFacilityId, type, content, deviceId });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "입력 내용을 확인해 주세요.");
      return;
    }
    setError("");
    reportMutation.mutate(result.data);
  }

  function resetForm() {
    setContent("");
    setType("full");
    setError("");
    reportMutation.reset();
  }

  return (
    <div className="min-h-[calc(100dvh-138px)] px-4 py-6 sm:px-6 lg:min-h-[calc(100dvh-68px)] lg:py-10">
      <div className="mx-auto max-w-[1080px]">
        <PageHeader title="수거함 제보" description="현장 정보가 다르면 익명으로 알려주세요." />

        <div className="mt-6 inline-flex rounded-2xl bg-[#e8eeea] p-1">
          <button type="button" onClick={() => setActiveTab("new")} className={cn("h-10 rounded-xl px-5 text-[13px] font-extrabold transition", activeTab === "new" ? "bg-white text-[var(--ink)] shadow-sm" : "text-[var(--sub)]")}>새 제보</button>
          <button type="button" onClick={() => setActiveTab("history")} className={cn("h-10 rounded-xl px-5 text-[13px] font-extrabold transition", activeTab === "history" ? "bg-white text-[var(--ink)] shadow-sm" : "text-[var(--sub)]")}>내 제보</button>
        </div>

        {activeTab === "new" && !reportMutation.isSuccess && (
          <form onSubmit={handleSubmit} className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4">
              <section className="rounded-[24px] border border-[var(--line)] bg-white p-5 sm:p-6">
                <label htmlFor="facility" className="text-[15px] font-black tracking-[-0.02em]">제보할 장소</label>
                <div className="relative mt-3">
                  <MapPin className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-[var(--brand)]" />
                  <select id="facility" value={effectiveFacilityId} onChange={(event) => setFacilityId(event.target.value)} disabled={facilitiesQuery.isPending || facilities.length === 0} className="h-13 w-full appearance-none rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] pl-11 pr-10 text-[13px] font-bold text-[var(--ink)] outline-none transition focus:border-[var(--brand)] focus:bg-white disabled:text-[var(--faint)]">
                    {facilities.length === 0 && <option value="">선택 가능한 시설이 없습니다</option>}
                    {facilities.map((facility) => <option key={facility.id} value={facility.id}>{facility.name}</option>)}
                  </select>
                  <ChevronRight className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 rotate-90 text-[var(--faint)]" />
                </div>
                {facilitiesQuery.isError && <p className="mt-3 flex items-center gap-1.5 text-[12px] font-bold text-rose-600"><TriangleAlert className="size-4" /> 시설 목록을 불러오지 못했습니다.</p>}
              </section>

              <section className="rounded-[24px] border border-[var(--line)] bg-white p-5 sm:p-6">
                <h2 className="text-[15px] font-black tracking-[-0.02em]">어떤 문제인가요?</h2>
                <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                  {REPORT_TYPES.map((reportType) => {
                    const selected = reportType.id === type;
                    return <button key={reportType.id} type="button" onClick={() => setType(reportType.id)} className={cn("flex items-center gap-3 rounded-2xl border p-3.5 text-left transition", selected ? "border-[var(--brand)] bg-[var(--brand-pale)] ring-1 ring-[var(--brand)]/10" : "border-[var(--line)] hover:bg-[var(--surface-muted)]")}><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white shadow-sm"><CircleDot className="size-[18px]" style={{ color: reportType.color }} /></span><span className="min-w-0"><strong className="block text-[13px] text-[var(--ink)]">{reportType.label}</strong><span className="block truncate text-[11px] text-[var(--sub)]">{reportType.description}</span></span>{selected && <Check className="ml-auto size-4 shrink-0 text-[var(--brand)]" />}</button>;
                  })}
                </div>
              </section>

              <section className="rounded-[24px] border border-[var(--line)] bg-white p-5 sm:p-6">
                <div className="flex items-center justify-between"><label htmlFor="report-content" className="text-[15px] font-black tracking-[-0.02em]">상황을 알려주세요</label><span className="text-[11px] font-semibold text-[var(--faint)]">{content.length}/300</span></div>
                <textarea id="report-content" value={content} maxLength={300} onChange={(event) => setContent(event.target.value)} placeholder="현장에서 확인한 상황을 적어 주세요." className="mt-3 min-h-32 w-full resize-none rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] p-4 text-[13px] leading-6 outline-none transition placeholder:text-[#9aa49f] focus:border-[var(--brand)] focus:bg-white" />
                {error && <p role="alert" className="mt-2 text-[12px] font-bold text-rose-600">{error}</p>}
                {reportMutation.isError && <p role="alert" className="mt-2 text-[12px] font-bold text-rose-600">제보를 저장하지 못했습니다. API와 Oracle 연결을 확인해 주세요.</p>}
                <button type="button" disabled className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-dashed border-[#cbd6d0] bg-[#fafcfb] p-4 text-left opacity-60"><span className="grid size-10 place-items-center rounded-xl bg-white text-[var(--brand-deep)] shadow-sm"><ImagePlus className="size-5" /></span><span><strong className="block text-[12px] text-[var(--ink)]">사진 첨부</strong><span className="text-[11px] text-[var(--sub)]">객체 저장소 연결 후 제공됩니다</span></span></button>
              </section>
            </div>

            <aside className="space-y-4">
              <div className="rounded-[24px] bg-[#12392f] p-5 text-white"><ShieldCheck className="size-7 text-[#69d4aa]" /><h2 className="mt-4 text-[16px] font-black">익명으로 안전하게</h2><p className="mt-2 text-[12px] leading-5 text-white/60">로그인 없이 제보할 수 있습니다. 무작위 기기 ID는 내 제보 조회에만 사용됩니다.</p></div>
              <div className="rounded-[22px] border border-[var(--line)] bg-white p-4 text-[12px] leading-5 text-[var(--sub)]"><p className="font-extrabold text-[var(--ink)]">처리 상태</p><p className="mt-2">접수된 제보는 Oracle에 저장되고 운영 확인 상태에 따라 접수됨, 확인 중, 반영 완료로 표시됩니다.</p></div>
              <button type="submit" disabled={reportMutation.isPending || !effectiveFacilityId || !deviceId} className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--brand)] text-[13px] font-extrabold text-white shadow-[0_10px_24px_rgba(15,159,110,0.22)] transition hover:bg-[var(--brand-deep)] disabled:opacity-60">{reportMutation.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}{reportMutation.isPending ? "제보 보내는 중" : "제보 보내기"}</button>
            </aside>
          </form>
        )}

        {activeTab === "new" && reportMutation.isSuccess && (
          <div className="mt-5 rounded-[28px] border border-[var(--line)] bg-white px-5 py-14 text-center shadow-sm"><span className="mx-auto grid size-16 place-items-center rounded-[22px] bg-[var(--brand-soft)] text-[var(--brand-deep)]"><Check className="size-8" strokeWidth={3} /></span><h2 className="mt-5 text-[22px] font-black tracking-[-0.04em]">제보가 접수됐어요</h2><p className="mt-2 text-[13px] leading-6 text-[var(--sub)]">이 기기의 ‘내 제보’에서 저장된 내용을 확인할 수 있어요.</p><div className="mt-6 flex justify-center gap-2"><button type="button" onClick={() => setActiveTab("history")} className="h-11 rounded-xl border border-[var(--line)] px-4 text-[12px] font-extrabold">내 제보 보기</button><button type="button" onClick={resetForm} className="h-11 rounded-xl bg-[var(--brand)] px-4 text-[12px] font-extrabold text-white">다른 제보하기</button></div></div>
        )}

        {activeTab === "history" && (
          <section className="mt-5 space-y-3">
            {reportsQuery.isPending && <div className="rounded-[22px] bg-white p-10 text-center"><LoaderCircle className="mx-auto size-6 animate-spin text-[var(--brand)]" /></div>}
            {reportsQuery.isError && <div className="rounded-[22px] border border-rose-100 bg-white p-10 text-center"><TriangleAlert className="mx-auto size-6 text-rose-500" /><p className="mt-3 text-[13px] font-bold text-rose-700">내 제보를 불러오지 못했습니다.</p><button type="button" onClick={() => reportsQuery.refetch()} className="mt-3 rounded-xl border border-[var(--line)] px-3 py-2 text-[11px] font-extrabold">다시 시도</button></div>}
            {reportsQuery.data?.map((report) => <article key={report.id} className="rounded-[22px] border border-[var(--line)] bg-white p-5 sm:flex sm:items-center sm:gap-5"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--surface-muted)] text-[var(--brand-deep)]"><Camera className="size-5" /></span><div className="mt-3 min-w-0 flex-1 sm:mt-0"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-[14px] font-black">{report.facilityName}</h2><span className="rounded-full bg-[#fff3df] px-2 py-1 text-[10px] font-extrabold text-[#ac7218]">{REPORT_TYPE_BY_ID[report.type].label}</span></div><p className="mt-1 truncate text-[12px] text-[var(--sub)]">{report.content}</p><p className="mt-2 flex items-center gap-1 text-[11px] text-[var(--faint)]"><Clock3 className="size-3" /> {formatDateTime(report.createdAt)}</p></div><span className={cn("mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-extrabold sm:mt-0", report.status === "resolved" ? "bg-[var(--brand-soft)] text-[var(--brand-deep)]" : "bg-blue-50 text-blue-700")}>{report.status === "resolved" ? <Check className="size-3.5" /> : <LoaderCircle className="size-3.5" />}{REPORT_STATUS_LABELS[report.status]}</span></article>)}
            {reportsQuery.data?.length === 0 && <div className="rounded-[22px] border border-[var(--line)] bg-white p-12 text-center"><Send className="mx-auto size-7 text-[var(--faint)]" /><h2 className="mt-3 text-[16px] font-black">아직 제보가 없습니다.</h2><button type="button" onClick={() => setActiveTab("new")} className="mt-4 rounded-xl bg-[var(--brand)] px-4 py-2.5 text-[12px] font-extrabold text-white">새 제보 작성</button></div>}
          </section>
        )}
      </div>
    </div>
  );
}
