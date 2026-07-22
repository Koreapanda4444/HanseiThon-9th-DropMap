"use client";

import { ChevronLeft, ChevronRight, LayoutGrid } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type WheelEvent } from "react";
import { CategoryIcon } from "@/components/ui/category-icon";
import { FACILITY_CATEGORIES } from "@/config/facility-categories";
import { cn } from "@/lib/utils";
import type { FacilityCategoryId } from "@/types/domain";

export function CategoryChips({ value, onChange, className, compact = false }: {
  value: FacilityCategoryId | "all";
  onChange: (value: FacilityCategoryId | "all") => void;
  className?: string;
  compact?: boolean;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    setCanScrollLeft(scroller.scrollLeft > 2);
    setCanScrollRight(scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 2);
  }, []);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    updateScrollState();
    const observer = new ResizeObserver(updateScrollState);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, [updateScrollState]);

  function scroll(direction: -1 | 1) {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.scrollBy({ left: direction * Math.max(160, scroller.clientWidth * 0.7), behavior: "smooth" });
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    event.preventDefault();
    scrollerRef.current?.scrollBy({ left: event.deltaY, behavior: "auto" });
  }

  return (
    <div className={cn("relative", className)}>
      <button type="button" onClick={() => scroll(-1)} disabled={!canScrollLeft} aria-label="이전 필터" className={cn("absolute left-0 top-1/2 z-10 hidden size-7 -translate-y-1/2 place-items-center rounded-full border border-[var(--line)] bg-white text-[var(--ink)] shadow-sm transition lg:grid", !canScrollLeft && "pointer-events-none opacity-0")}><ChevronLeft className="size-4" /></button>
      <div ref={scrollerRef} onScroll={updateScrollState} onWheel={handleWheel} className="no-scrollbar flex gap-2 overflow-x-auto lg:px-8" role="group" aria-label="수거함 종류 필터">
        <button type="button" onClick={() => onChange("all")} aria-pressed={value === "all"} className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full border bg-white font-bold transition", compact ? "h-9 px-2.5 text-[11px]" : "h-11 px-4 text-[13px]", value === "all" ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--line)] text-[var(--ink)] hover:border-[#b8c3cc]")}>
          <LayoutGrid className="size-4" />
          전체
        </button>
        {FACILITY_CATEGORIES.map((category) => {
          const selected = category.id === value;
          return (
            <button key={category.id} type="button" onClick={() => onChange(category.id)} aria-pressed={selected} className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full border bg-white font-bold transition", compact ? "h-9 px-2.5 text-[11px]" : "h-11 px-4 text-[13px]", selected ? "text-white" : "border-[var(--line)] text-[var(--ink)] hover:border-[#b8c3cc]")} style={selected ? { backgroundColor: category.color, borderColor: category.color } : undefined}>
              <CategoryIcon categoryId={category.id} className="size-4" />
              {category.shortLabel}
            </button>
          );
        })}
      </div>
      <button type="button" onClick={() => scroll(1)} disabled={!canScrollRight} aria-label="다음 필터" className={cn("absolute right-0 top-1/2 z-10 hidden size-7 -translate-y-1/2 place-items-center rounded-full border border-[var(--line)] bg-white text-[var(--ink)] shadow-sm transition lg:grid", !canScrollRight && "pointer-events-none opacity-0")}><ChevronRight className="size-4" /></button>
    </div>
  );
}
