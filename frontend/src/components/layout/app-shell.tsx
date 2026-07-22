"use client";

import Link from "next/link";
import { Bookmark, Map, Menu, Search, Send } from "lucide-react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/ui/brand-mark";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "지도", icon: Map },
  { href: "/search", label: "품목 검색", icon: Search },
  { href: "/favorites", label: "저장", icon: Bookmark },
  { href: "/report", label: "제보", icon: Send },
  { href: "/more", label: "더보기", icon: Menu },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hideNavigation = pathname.startsWith("/directions/");

  return (
    <div className="min-h-dvh bg-[var(--app-bg)]">
      {!hideNavigation && (
        <header className="fixed inset-x-0 top-0 z-50 hidden h-[68px] border-b border-[var(--line)] bg-white/95 backdrop-blur-xl lg:block">
          <div className="mx-auto flex h-full max-w-[1680px] items-center justify-between px-7 xl:px-10">
            <BrandMark />
            <nav className="flex items-center gap-1" aria-label="주요 메뉴">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = isActive(pathname, item.href);
                return (
                  <Link key={item.href} href={item.href} className={cn("flex h-10 items-center gap-2 rounded-xl px-4 text-[14px] font-bold transition", active ? "bg-[var(--brand-soft)] text-[var(--brand-deep)]" : "text-[var(--sub)] hover:bg-[var(--surface-muted)] hover:text-[var(--ink)]")}>
                    <Icon className="size-[18px]" strokeWidth={active ? 2.4 : 2} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </header>
      )}

      <main className={cn(!hideNavigation && "pb-[calc(74px+env(safe-area-inset-bottom))] lg:pb-0 lg:pt-[68px]")}>{children}</main>

      {!hideNavigation && (
        <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-black/[0.06] bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden" aria-label="모바일 메뉴">
          <div className="mx-auto grid h-[70px] max-w-lg grid-cols-5 px-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isActive(pathname, item.href);
              return (
                <Link key={item.href} href={item.href} className={cn("relative flex flex-col items-center justify-center gap-1 text-[10px] font-bold transition", active ? "text-[var(--brand-deep)]" : "text-[#98a2ad]")}>
                  {active && <span className="absolute top-0 h-[3px] w-7 rounded-b-full bg-[var(--brand)]" />}
                  <Icon className="size-[21px]" strokeWidth={active ? 2.6 : 2} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
