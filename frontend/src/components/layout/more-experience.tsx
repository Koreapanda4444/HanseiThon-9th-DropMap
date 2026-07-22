"use client";

import { useQuery } from "@tanstack/react-query";
import { Bell, ChevronRight, Database, Download, ExternalLink, HelpCircle, Info, LocateFixed, MapPinned, RotateCcw, ShieldCheck, Smartphone, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { fetchStats } from "@/lib/api";
import { cn } from "@/lib/utils";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={cn("relative h-7 w-12 rounded-full transition", checked ? "bg-[var(--brand)]" : "bg-[#d5dcd8]")}><span className={cn("absolute top-1 size-5 rounded-full bg-white shadow-sm transition-all", checked ? "left-6" : "left-1")} /></button>;
}

export function MoreExperience() {
  const statsQuery = useQuery({ queryKey: ["service-stats"], queryFn: fetchStats });
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [locationEnabled, setLocationEnabled] = useState(true);
  const [noticeEnabled, setNoticeEnabled] = useState(false);
  const [installed, setInstalled] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches,
  );

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function installApp() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setInstallPrompt(null);
  }

  return (
    <div className="min-h-[calc(100dvh-138px)] px-4 py-6 sm:px-6 lg:min-h-[calc(100dvh-68px)] lg:py-10">
      <div className="mx-auto max-w-[960px]">
        <PageHeader title="더보기" description="버릴지도를 내 생활에 맞게 설정하세요." />

        <section className="relative mt-6 overflow-hidden rounded-[28px] bg-[#12392f] p-6 text-white sm:p-8">
          <div className="absolute -right-12 -top-16 size-52 rounded-full bg-[#2ac08a]/20 blur-2xl" />
          <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4"><span className="grid size-13 place-items-center rounded-[18px] bg-white/10 text-[#78ddb6]"><MapPinned className="size-6" /></span><div><p className="text-[11px] font-bold text-[#7fe0ba]">로그인 없이 바로 사용</p><h2 className="mt-1 text-[20px] font-black tracking-[-0.04em]">내 주변 분리배출 도우미</h2><p className="mt-1 text-[12px] text-white/55">저장한 장소와 최근 검색은 이 기기에만 보관돼요.</p></div></div>
            <div className="flex gap-6 border-t border-white/10 pt-4 sm:border-l sm:border-t-0 sm:pl-7 sm:pt-0"><div><p className="text-[22px] font-black">{statsQuery.data?.facilities.toLocaleString("ko-KR") ?? "—"}</p><p className="text-[10px] text-white/50">등록 시설</p></div><div><p className="text-[22px] font-black">{statsQuery.data?.sources.toLocaleString("ko-KR") ?? "—"}</p><p className="text-[10px] text-white/50">데이터 출처</p></div></div>
          </div>
        </section>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <section className="rounded-[24px] border border-[var(--line)] bg-white p-5">
            <h2 className="text-[14px] font-black">앱처럼 사용하기</h2>
            <div className="mt-4 flex items-center gap-3 rounded-2xl bg-[var(--brand-pale)] p-4"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white text-[var(--brand-deep)] shadow-sm"><Smartphone className="size-5" /></span><div className="min-w-0 flex-1"><p className="text-[13px] font-extrabold">홈 화면에 버릴지도 설치</p><p className="mt-0.5 text-[11px] text-[var(--sub)]">주소창 없이 빠르게 실행할 수 있어요.</p></div>{installed ? <span className="shrink-0 rounded-full bg-[var(--brand-soft)] px-2.5 py-1 text-[10px] font-extrabold text-[var(--brand-deep)]">설치됨</span> : <button type="button" onClick={installApp} disabled={!installPrompt} className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--brand)] text-white disabled:bg-[#b7c4be]" aria-label="앱 설치"><Download className="size-4" /></button>}</div>
            {!installPrompt && !installed && <p className="mt-3 text-[11px] leading-5 text-[var(--faint)]">브라우저 메뉴의 ‘홈 화면에 추가’를 이용해 주세요.</p>}
          </section>

          <section className="rounded-[24px] border border-[var(--line)] bg-white p-5">
            <h2 className="text-[14px] font-black">내 설정</h2>
            <div className="mt-3 divide-y divide-[var(--line-soft)]">
              <div className="flex items-center gap-3 py-3"><span className="grid size-9 place-items-center rounded-xl bg-blue-50 text-blue-600"><LocateFixed className="size-[18px]" /></span><div className="min-w-0 flex-1"><p className="text-[13px] font-bold">내 위치 사용</p><p className="text-[10px] text-[var(--faint)]">가까운 시설을 거리순으로 표시</p></div><Toggle checked={locationEnabled} onChange={setLocationEnabled} label="내 위치 사용" /></div>
              <div className="flex items-center gap-3 py-3"><span className="grid size-9 place-items-center rounded-xl bg-amber-50 text-amber-600"><Bell className="size-[18px]" /></span><div className="min-w-0 flex-1"><p className="text-[13px] font-bold">제보 처리 알림</p><p className="text-[10px] text-[var(--faint)]">내 제보가 반영되면 알려드려요</p></div><Toggle checked={noticeEnabled} onChange={setNoticeEnabled} label="제보 처리 알림" /></div>
            </div>
          </section>

          <section className="rounded-[24px] border border-[var(--line)] bg-white p-5">
            <h2 className="text-[14px] font-black">데이터와 서비스</h2>
            <div className="mt-3 divide-y divide-[var(--line-soft)]">
              <button type="button" className="flex w-full items-center gap-3 py-3 text-left"><Database className="size-[18px] text-[var(--brand)]" /><span className="flex-1 text-[13px] font-bold">공공데이터 출처</span><ChevronRight className="size-4 text-[var(--faint)]" /></button>
              <button type="button" className="flex w-full items-center gap-3 py-3 text-left"><ShieldCheck className="size-[18px] text-blue-600" /><span className="flex-1 text-[13px] font-bold">개인정보 처리 안내</span><ChevronRight className="size-4 text-[var(--faint)]" /></button>
              <button type="button" className="flex w-full items-center gap-3 py-3 text-left"><HelpCircle className="size-[18px] text-violet-600" /><span className="flex-1 text-[13px] font-bold">도움말과 자주 묻는 질문</span><ChevronRight className="size-4 text-[var(--faint)]" /></button>
            </div>
          </section>

          <section className="rounded-[24px] border border-[var(--line)] bg-white p-5">
            <h2 className="text-[14px] font-black">서비스 정보</h2>
            <div className="mt-4 flex items-start gap-3 rounded-2xl bg-[var(--surface-muted)] p-4"><Sparkles className="mt-0.5 size-[18px] shrink-0 text-[var(--brand)]" /><div><p className="text-[13px] font-extrabold">버릴지도</p><p className="mt-1 text-[11px] leading-5 text-[var(--sub)]">Next.js, Kakao Maps, Fastify, Oracle Spatial 기반의 반응형 PWA입니다.</p><p className="mt-2 text-[10px] font-bold text-[var(--faint)]">Version 0.1.0 · HanseiThon 9th</p></div></div>
            <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => window.location.reload()} className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-[var(--line)] text-[11px] font-bold"><RotateCcw className="size-3.5" /> 데이터 새로고침</button><button type="button" className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-[var(--line)] text-[11px] font-bold"><Info className="size-3.5" /> 오픈소스 <ExternalLink className="size-3" /></button></div>
          </section>
        </div>
      </div>
    </div>
  );
}
