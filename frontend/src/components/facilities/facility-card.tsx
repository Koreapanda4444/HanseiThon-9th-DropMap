"use client";

import Link from "next/link";
import { Bookmark, ChevronRight, Clock3, Footprints, MapPin } from "lucide-react";
import { CategoryIcon } from "@/components/ui/category-icon";
import { StatusBadge } from "@/components/ui/status-badge";
import { getPrimaryCategory } from "@/config/facility-categories";
import { cn, formatDistance } from "@/lib/utils";
import { useAppStore } from "@/store/use-app-store";
import type { Facility } from "@/types/domain";

export function FacilityCard({ facility, selected = false, compact = false, onSelect, className }: {
  facility: Facility;
  selected?: boolean;
  compact?: boolean;
  onSelect?: (facility: Facility) => void;
  className?: string;
}) {
  const favoriteIds = useAppStore((state) => state.favoriteIds);
  const toggleFavorite = useAppStore((state) => state.toggleFavorite);
  const primaryCategory = getPrimaryCategory(facility);
  const favorite = favoriteIds.includes(facility.id);

  return (
    <article onClick={() => onSelect?.(facility)} className={cn("group relative rounded-[22px] border bg-white transition", compact ? "p-4" : "p-5", selected ? "border-[var(--brand)] shadow-[0_14px_35px_rgba(23,39,35,0.12)] ring-1 ring-[var(--brand)]/10" : "border-[var(--line)] shadow-[0_5px_18px_rgba(23,39,35,0.05)] hover:-translate-y-0.5 hover:border-[#c8d3cc] hover:shadow-[0_12px_28px_rgba(23,39,35,0.09)]", onSelect && "cursor-pointer", className)}>
      <div className="flex items-start gap-3.5">
        <span className="grid size-11 shrink-0 place-items-center rounded-[15px]" style={{ backgroundColor: primaryCategory.softColor, color: primaryCategory.color }}>
          <CategoryIcon categoryId={primaryCategory.id} className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="mb-1 text-[12px] font-bold" style={{ color: primaryCategory.color }}>{primaryCategory.label}</p>
              <Link href={`/facility/${facility.id}`} onClick={(event) => event.stopPropagation()} className="line-clamp-2 text-[16px] font-extrabold leading-[1.4] tracking-[-0.025em] text-[var(--ink)] hover:text-[var(--brand-deep)]">
                {facility.name}
              </Link>
            </div>
            <button type="button" onClick={(event) => { event.stopPropagation(); toggleFavorite(facility.id); }} aria-label={favorite ? `${facility.name} 저장 취소` : `${facility.name} 저장`} className={cn("grid size-9 shrink-0 place-items-center rounded-full transition", favorite ? "bg-[var(--brand-soft)] text-[var(--brand-deep)]" : "bg-[var(--surface-muted)] text-[#8b96a1] hover:text-[var(--brand-deep)]")}>
              <Bookmark className={cn("size-[18px]", favorite && "fill-current")} />
            </button>
          </div>
          <p className="mt-2 flex items-center gap-1.5 truncate text-[13px] text-[var(--sub)]">
            <MapPin className="size-3.5 shrink-0" />
            {facility.address}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <StatusBadge status={facility.status} label={facility.statusText} />
        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-[12px] font-bold text-[var(--sub)]">
          <Footprints className="size-3.5" /> {formatDistance(facility.distanceM)}{facility.walkMinutes !== null && ` · 약 ${facility.walkMinutes}분`}
        </span>
        {!compact && (
          <span className="inline-flex items-center gap-1 text-[12px] text-[#8a96a1]">
            <Clock3 className="size-3.5" /> {facility.openingHours ?? "운영시간 정보 없음"}
          </span>
        )}
      </div>

      {!compact && (
        <div className="mt-4 flex items-center justify-between border-t border-[var(--line-soft)] pt-3.5">
          <p className="min-w-0 truncate text-[12px] text-[var(--sub)]">{facility.acceptedItems.slice(0, 3).join(" · ") || "등록된 품목 정보 없음"}</p>
          <Link href={`/facility/${facility.id}`} onClick={(event) => event.stopPropagation()} className="ml-3 inline-flex shrink-0 items-center gap-0.5 text-[12px] font-extrabold text-[var(--brand-deep)]">
            상세보기 <ChevronRight className="size-4" />
          </Link>
        </div>
      )}
    </article>
  );
}
