"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Clock3, ExternalLink, Footprints, LocateFixed, MapPin, Navigation, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { KakaoMap } from "@/components/map/kakao-map";
import { fetchFacility } from "@/lib/api";
import { formatDistance } from "@/lib/utils";
import type { Facility } from "@/types/domain";

export function DirectionsExperience({ id }: { id: string }) {
  const facilityQuery = useQuery({
    queryKey: ["facility", id],
    queryFn: () => fetchFacility(id),
    retry: false,
  });

  if (facilityQuery.isPending) {
    return <div className="h-dvh animate-pulse bg-[#eef2ef]" />;
  }

  if (facilityQuery.isError) {
    return (
      <div className="grid h-dvh place-items-center bg-white px-4">
        <div className="max-w-sm text-center"><TriangleAlert className="mx-auto size-7 text-rose-500" /><h1 className="mt-4 text-[18px] font-black">목적지 정보를 불러오지 못했습니다.</h1><Link href="/" className="mt-5 inline-flex rounded-xl bg-[var(--brand)] px-4 py-2.5 text-[12px] font-extrabold text-white">지도로 돌아가기</Link></div>
      </div>
    );
  }

  return <DirectionsView facility={facilityQuery.data} />;
}

export function DirectionsView({ facility }: { facility: Facility }) {
  const destination = `${facility.name},${facility.coordinates.latitude},${facility.coordinates.longitude}`;
  const directionsUrl = `https://map.kakao.com/link/to/${encodeURIComponent(destination)}`;
  const placeUrl = `https://map.kakao.com/link/map/${encodeURIComponent(destination)}`;

  return (
    <div className="flex min-h-dvh flex-col bg-white lg:flex-row">
      <aside className="relative z-30 order-2 flex flex-1 flex-col bg-white lg:order-1 lg:w-[420px] lg:flex-none lg:border-r lg:border-[var(--line)]">
        <header className="flex items-center gap-3 border-b border-[var(--line)] px-4 py-4 sm:px-6">
          <Link href={`/facility/${facility.id}`} aria-label="길찾기 닫기" className="grid size-10 place-items-center rounded-full bg-[var(--surface-muted)]"><ArrowLeft className="size-5" /></Link>
          <div className="min-w-0"><p className="text-[11px] font-bold text-[var(--brand-deep)]">길찾기</p><h1 className="truncate text-[16px] font-black">{facility.name}</h1></div>
        </header>

        <div className="p-4 sm:p-6">
          <div className="rounded-[22px] bg-[#12392f] p-5 text-white">
            <div className="flex items-start justify-between"><div><p className="text-[11px] font-bold text-[#78dab4]">목적지</p><p className="mt-1 text-[21px] font-black leading-snug tracking-[-0.04em]">{facility.name}</p></div><span className="grid size-11 place-items-center rounded-2xl bg-white/10 text-[#7de0b9]"><Navigation className="size-5 fill-current" /></span></div>
            <div className="mt-4 flex flex-wrap items-center gap-4 text-[12px] text-white/65"><span className="flex items-center gap-1"><Footprints className="size-4" /> {formatDistance(facility.distanceM)}</span>{facility.walkMinutes !== null && <span className="flex items-center gap-1"><Clock3 className="size-4" /> 도보 약 {facility.walkMinutes}분</span>}</div>
          </div>

          <section className="mt-5 rounded-[22px] border border-[var(--line)] p-5">
            <h2 className="text-[14px] font-black">장소 정보</h2>
            <p className="mt-3 flex gap-2 text-[12px] leading-5 text-[var(--sub)]"><MapPin className="mt-0.5 size-4 shrink-0 text-[var(--brand)]" /><span>{facility.address}{facility.detailLocation && <span className="mt-1 block text-[var(--faint)]">{facility.detailLocation}</span>}</span></p>
            <p className="mt-4 rounded-2xl bg-[var(--surface-muted)] p-4 text-[11px] leading-5 text-[var(--sub)]">실제 보행 경로와 예상 시간은 카카오맵에서 현재 교통 상황을 기준으로 확인합니다.</p>
          </section>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <a href={placeUrl} target="_blank" rel="noreferrer" className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-[var(--line)] text-[11px] font-extrabold">장소 보기 <ExternalLink className="size-3.5" /></a>
            <Link href={`/facility/${facility.id}`} className="flex h-11 items-center justify-center rounded-xl border border-[var(--line)] text-[11px] font-extrabold">상세 정보</Link>
          </div>
        </div>

        <div className="mt-auto border-t border-[var(--line)] p-4 sm:p-5">
          <a href={directionsUrl} target="_blank" rel="noreferrer" className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--brand)] text-[13px] font-extrabold text-white"><LocateFixed className="size-4" /> 카카오맵에서 경로 열기</a>
        </div>
      </aside>

      <section className="relative order-1 h-[42dvh] min-h-[300px] lg:order-2 lg:h-dvh lg:flex-1">
        <KakaoMap facilities={[facility]} selectedId={facility.id} onSelect={() => undefined} className="size-full" />
        <Link href={`/facility/${facility.id}`} className="absolute left-4 top-[max(14px,env(safe-area-inset-top))] z-40 grid size-11 place-items-center rounded-full bg-white text-[var(--ink)] shadow-lg lg:hidden" aria-label="장소 상세로 돌아가기"><ArrowLeft className="size-5" /></Link>
      </section>
    </div>
  );
}
