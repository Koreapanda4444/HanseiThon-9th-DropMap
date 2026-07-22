"use client";

import { useQuery } from "@tanstack/react-query";
import { Bookmark, Check, ChevronRight, Clock3, Database, Footprints, Info, MapPin, Navigation, Send, ShieldCheck, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { KakaoMap } from "@/components/map/kakao-map";
import { CategoryIcon } from "@/components/ui/category-icon";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { getPrimaryCategory } from "@/config/facility-categories";
import { fetchFacility } from "@/lib/api";
import { cn, formatDateTime, formatDistance } from "@/lib/utils";
import { useAppStore } from "@/store/use-app-store";
import type { Facility } from "@/types/domain";

export function FacilityDetailExperience({ id }: { id: string }) {
  const facilityQuery = useQuery({
    queryKey: ["facility", id],
    queryFn: ({ signal }) => fetchFacility(id, signal),
    retry: false,
  });

  if (facilityQuery.isPending) {
    return <div className="mx-auto min-h-[calc(100dvh-138px)] max-w-[1120px] px-4 py-6 sm:px-6 lg:min-h-[calc(100dvh-68px)] lg:py-8"><div className="h-[520px] animate-pulse rounded-[28px] bg-[#eef2ef]" /></div>;
  }

  if (facilityQuery.isError) {
    return (
      <div className="grid min-h-[calc(100dvh-138px)] place-items-center px-4 lg:min-h-[calc(100dvh-68px)]">
        <div className="max-w-sm rounded-[26px] border border-rose-100 bg-white p-8 text-center shadow-sm">
          <TriangleAlert className="mx-auto size-7 text-rose-500" />
          <h1 className="mt-4 text-[18px] font-black">장소 정보를 불러오지 못했습니다.</h1>
          <div className="mt-5 flex justify-center gap-2"><Link href="/" className="rounded-xl border border-[var(--line)] px-4 py-2.5 text-[12px] font-extrabold">지도로 돌아가기</Link><button type="button" onClick={() => facilityQuery.refetch()} className="rounded-xl bg-[var(--brand)] px-4 py-2.5 text-[12px] font-extrabold text-white">다시 시도</button></div>
        </div>
      </div>
    );
  }

  return <FacilityDetailView facility={facilityQuery.data} />;
}

export function FacilityDetailView({ facility }: { facility: Facility }) {
  const favoriteIds = useAppStore((state) => state.favoriteIds);
  const toggleFavorite = useAppStore((state) => state.toggleFavorite);
  const favorite = favoriteIds.includes(facility.id);
  const primaryCategory = getPrimaryCategory(facility);

  return (
    <div className="min-h-[calc(100dvh-138px)] px-4 py-5 sm:px-6 lg:min-h-[calc(100dvh-68px)] lg:py-8">
      <div className="mx-auto max-w-[1120px]">
        <PageHeader title="장소 상세" backHref="/" action={<button type="button" onClick={() => toggleFavorite(facility.id)} aria-label={favorite ? "저장 취소" : "장소 저장"} className={cn("grid size-11 place-items-center rounded-full border transition", favorite ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-deep)]" : "border-[var(--line)] bg-white text-[var(--sub)]")}><Bookmark className={cn("size-5", favorite && "fill-current")} /></button>} />

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
          <section className="overflow-hidden rounded-[28px] border border-[var(--line)] bg-white">
            <KakaoMap facilities={[facility]} selectedId={facility.id} onSelect={() => undefined} className="h-[280px] sm:h-[360px]" />
            <div className="p-5 sm:p-7">
              <div className="flex items-start gap-4">
                <span className="grid size-13 shrink-0 place-items-center rounded-[18px]" style={{ backgroundColor: primaryCategory.softColor, color: primaryCategory.color }}><CategoryIcon categoryId={primaryCategory.id} className="size-6" /></span>
                <div className="min-w-0 flex-1"><p className="text-[12px] font-extrabold" style={{ color: primaryCategory.color }}>{primaryCategory.label}</p><h1 className="mt-1 text-[22px] font-black leading-[1.35] tracking-[-0.045em] sm:text-[26px]">{facility.name}</h1><div className="mt-3 flex flex-wrap items-center gap-2"><StatusBadge status={facility.status} label={facility.statusText} /><span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-[12px] font-bold text-[var(--sub)]"><Footprints className="size-3.5" /> {formatDistance(facility.distanceM)}{facility.walkMinutes !== null && ` · 도보 약 ${facility.walkMinutes}분`}</span></div></div>
              </div>

              <dl className="mt-6 divide-y divide-[var(--line-soft)] border-y border-[var(--line-soft)]">
                <div className="grid grid-cols-[84px_1fr] gap-3 py-4 text-[13px]"><dt className="font-bold text-[var(--faint)]">주소</dt><dd className="font-semibold text-[var(--ink)]">{facility.address}{facility.detailLocation && <span className="mt-1 block text-[12px] font-normal text-[var(--sub)]">{facility.detailLocation}</span>}</dd></div>
                <div className="grid grid-cols-[84px_1fr] gap-3 py-4 text-[13px]"><dt className="font-bold text-[var(--faint)]">이용 시간</dt><dd className="flex items-center gap-1.5 font-semibold"><Clock3 className="size-4 text-[var(--brand)]" /> {facility.openingHours ?? "운영시간 정보 없음"}</dd></div>
                <div className="grid grid-cols-[84px_1fr] gap-3 py-4 text-[13px]"><dt className="font-bold text-[var(--faint)]">위치</dt><dd className="flex items-center gap-1.5 font-semibold"><MapPin className="size-4 text-[var(--brand)]" /> {facility.coordinates.latitude.toFixed(5)}, {facility.coordinates.longitude.toFixed(5)}</dd></div>
              </dl>

              <div className="mt-6"><h2 className="text-[15px] font-black">버릴 수 있는 품목</h2>{facility.acceptedItems.length ? <div className="mt-3 flex flex-wrap gap-2">{facility.acceptedItems.map((item) => <span key={item} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-soft)] px-3 py-2 text-[12px] font-bold text-[var(--brand-deep)]"><Check className="size-3.5" /> {item}</span>)}</div> : <p className="mt-3 rounded-2xl bg-[var(--surface-muted)] p-4 text-[12px] text-[var(--sub)]">등록된 품목 정보가 없습니다.</p>}</div>
              {facility.note && <div className="mt-5 flex gap-3 rounded-2xl bg-[#fff9eb] p-4 text-[12px] leading-5 text-[#796137]"><Info className="mt-0.5 size-4 shrink-0 text-amber-500" /> {facility.note}</div>}
            </div>
          </section>

          <aside className="space-y-4">
            <div className="rounded-[24px] border border-[var(--line)] bg-white p-5">
              <h2 className="text-[15px] font-black">이곳으로 가기</h2>
              <p className="mt-1 text-[12px] leading-5 text-[var(--sub)]">현재 위치에서 시설까지의 실제 도로 경로를 확인할 수 있어요.</p>
              <Link href={`/directions/${facility.id}`} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--brand)] text-[13px] font-extrabold text-white shadow-[0_9px_22px_rgba(15,159,110,0.2)]"><Navigation className="size-4 fill-current" /> 길찾기</Link>
              <Link href={`/report?facilityId=${encodeURIComponent(facility.id)}`} className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-[var(--line)] text-[12px] font-extrabold text-[var(--ink)]"><Send className="size-4" /> 이 장소 제보하기</Link>
            </div>

            <div className="rounded-[24px] border border-[var(--line)] bg-white p-5">
              <h2 className="flex items-center gap-2 text-[14px] font-black"><ShieldCheck className="size-[18px] text-[var(--brand)]" /> 정보 신뢰도</h2>
              <div className="mt-4 flex items-center justify-between rounded-2xl bg-[var(--surface-muted)] p-4"><div><p className="text-[13px] font-extrabold">{facility.verified ? "출처 확인됨" : "추가 확인 필요"}</p><p className="mt-1 text-[11px] text-[var(--sub)]">{formatDateTime(facility.updatedAt)}</p></div><span className={cn("grid size-9 place-items-center rounded-full", facility.verified ? "bg-[var(--brand-soft)] text-[var(--brand-deep)]" : "bg-amber-50 text-amber-600")}>{facility.verified ? <Check className="size-4" /> : <Clock3 className="size-4" />}</span></div>
              <div className="mt-4 flex items-center gap-2 text-[11px] text-[var(--sub)]"><Database className="size-3.5" /> 출처: {facility.source ?? "출처 정보 없음"}</div>
            </div>

            <Link href="/" className="flex items-center justify-between rounded-[22px] bg-[#12392f] p-5 text-white"><span><strong className="block text-[14px]">주변 다른 수거함 보기</strong><span className="mt-1 block text-[11px] text-white/55">지도 영역의 시설을 비교해요</span></span><ChevronRight className="size-5 text-[#72d9b1]" /></Link>
          </aside>
        </div>
      </div>
    </div>
  );
}
