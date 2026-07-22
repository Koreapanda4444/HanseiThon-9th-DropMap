import Link from "next/link";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

export function BrandMark({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <Link href="/" className={cn("group inline-flex items-center gap-2.5", className)} aria-label="버릴지도 홈">
      <span className="relative grid size-9 place-items-center rounded-[13px] bg-[var(--brand)] text-white shadow-[0_7px_18px_rgba(15,159,110,0.24)] transition-transform group-hover:-translate-y-0.5">
        <MapPin className="size-[19px]" strokeWidth={2.5} />
        <span className="absolute bottom-[9px] size-1.5 rounded-full bg-white" />
      </span>
      {!compact && (
        <span className="text-[20px] font-black tracking-[-0.06em] text-[var(--ink)]">
          버릴<span className="text-[var(--brand)]">지도</span>
        </span>
      )}
    </Link>
  );
}
