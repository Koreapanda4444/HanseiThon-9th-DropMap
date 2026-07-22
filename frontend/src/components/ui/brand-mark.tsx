import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

export function BrandMark({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <Link href="/" className={cn("group inline-flex items-center gap-2.5", className)} aria-label="버릴지도 홈">
      <Image
        src="/assets/brand-symbol.png"
        alt=""
        width={48}
        height={48}
        priority
        className="size-11 shrink-0 object-contain drop-shadow-[0_7px_12px_rgba(12,92,69,0.16)] transition-transform group-hover:-translate-y-0.5"
      />
      {!compact && (
        <span className="text-[20px] font-black tracking-[-0.06em] text-[var(--brand-navy)]">
          버릴<span className="text-[var(--brand)]">지도</span>
        </span>
      )}
    </Link>
  );
}
