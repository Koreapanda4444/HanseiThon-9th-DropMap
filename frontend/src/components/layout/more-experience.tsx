"use client";

import { ChevronDown, Database, HelpCircle, ShieldCheck } from "lucide-react";
import { AccountPanel } from "@/components/account/account-panel";
import { PageHeader } from "@/components/ui/page-header";

const INFORMATION_ITEMS = [
  {
    title: "공공데이터 출처",
    icon: Database,
    content: (
      <div className="space-y-2">
        <p>전국 휴지통, 폐의약품 수거함, 재활용센터, 폐형광등·폐건전지 수거함, 의류수거함 표준데이터를 사용합니다.</p>
        <p>중소형 폐가전 수거함은 한국환경공단 OpenAPI에서 제공받습니다. 각 시설의 상세 화면에서 개별 관리기관과 기준일을 확인할 수 있습니다.</p>
      </div>
    ),
  },
  {
    title: "개인정보 처리 안내",
    icon: ShieldCheck,
    content: (
      <div className="space-y-2">
        <p>계정 운영을 위해 이름과 이메일, 암호화된 비밀번호를 저장합니다. 비밀번호 원문은 저장하지 않습니다.</p>
        <p>로그인 상태는 브라우저에서 읽을 수 없는 세션 쿠키로 유지하며, 제보 내용은 로그인한 계정과 연결됩니다.</p>
      </div>
    ),
  },
  {
    title: "도움말과 자주 묻는 질문",
    icon: HelpCircle,
    content: (
      <div className="space-y-3">
        <div><strong className="text-[12px] text-[var(--ink)]">시설 위치가 다릅니다.</strong><p className="mt-1">제보 메뉴에서 시설을 찾은 뒤 ‘위치가 다름’을 선택해 알려주세요.</p></div>
        <div><strong className="text-[12px] text-[var(--ink)]">현재 위치가 이동하지 않습니다.</strong><p className="mt-1">브라우저의 위치 권한이 허용되어 있는지 확인해 주세요.</p></div>
        <div><strong className="text-[12px] text-[var(--ink)]">검색 결과가 보이지 않습니다.</strong><p className="mt-1">지도를 이동하거나 필터를 ‘전체’로 바꿔 다시 확인해 주세요.</p></div>
      </div>
    ),
  },
];

export function MoreExperience() {
  return (
    <div className="min-h-[calc(100dvh-138px)] px-4 py-4 sm:px-6 lg:min-h-[calc(100dvh-68px)] lg:py-6">
      <div className="mx-auto max-w-[720px]">
        <PageHeader title="더보기" />
        <div className="mt-4 space-y-4">
          <AccountPanel />
          <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
            {INFORMATION_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <details key={item.title} className="group border-b border-[var(--line-soft)] last:border-b-0">
                  <summary className="flex h-14 cursor-pointer list-none items-center gap-3 px-5 text-[13px] font-bold text-[var(--ink)]">
                    <Icon className="size-[18px] text-[var(--brand-deep)]" />
                    <span className="flex-1">{item.title}</span>
                    <ChevronDown className="size-4 text-[var(--faint)] transition group-open:rotate-180" />
                  </summary>
                  <div className="border-t border-[var(--line-soft)] bg-[#fafcfb] px-5 py-4 text-[11px] leading-5 text-[var(--sub)]">{item.content}</div>
                </details>
              );
            })}
          </section>
        </div>
      </div>
    </div>
  );
}
