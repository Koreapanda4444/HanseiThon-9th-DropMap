"use client";

import { LayoutGrid } from "lucide-react";
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
  return (
    <div className={cn("no-scrollbar flex gap-2 overflow-x-auto", className)} role="group" aria-label="수거함 종류 필터">
      <button type="button" onClick={() => onChange("all")} aria-pressed={value === "all"} className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full border bg-white font-bold shadow-sm transition", compact ? "h-10 px-3 text-[12px]" : "h-11 px-4 text-[13px]", value === "all" ? "border-[var(--brand)] bg-[var(--brand)] text-white shadow-[0_7px_18px_rgba(15,159,110,0.2)]" : "border-[var(--line)] text-[var(--ink)] hover:border-[#b8c3cc]")}>
        <LayoutGrid className="size-4" />
        전체
      </button>
      {FACILITY_CATEGORIES.map((category) => {
        const selected = category.id === value;
        return (
          <button key={category.id} type="button" onClick={() => onChange(category.id)} aria-pressed={selected} className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full border bg-white font-bold shadow-sm transition", compact ? "h-10 px-3 text-[12px]" : "h-11 px-4 text-[13px]", selected ? "text-white" : "border-[var(--line)] text-[var(--ink)] hover:border-[#b8c3cc]")} style={selected ? { backgroundColor: category.color, borderColor: category.color } : undefined}>
            <CategoryIcon categoryId={category.id} className="size-4" />
            {category.shortLabel}
          </button>
        );
      })}
    </div>
  );
}
