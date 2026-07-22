import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

export function PageHeader({ title, description, backHref, action }: { title: string; description?: string; backHref?: string; action?: ReactNode }) {
  return (
    <header className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3">
        {backHref && (
          <Link href={backHref} aria-label="뒤로 가기" className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-full border border-[var(--line)] bg-white text-[var(--ink)] transition hover:bg-[var(--surface-muted)]">
            <ArrowLeft className="size-5" />
          </Link>
        )}
        <div>
          <h1 className="text-[26px] font-black tracking-[-0.045em] text-[var(--ink)] sm:text-[30px]">{title}</h1>
          {description && <p className="mt-1 text-[14px] leading-6 text-[var(--sub)] sm:text-[15px]">{description}</p>}
        </div>
      </div>
      {action}
    </header>
  );
}
