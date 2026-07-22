import Link from "next/link";
import { RefreshCw, WifiOff } from "lucide-react";

export default function OfflinePage() {
  return (
    <div className="grid min-h-[calc(100dvh-140px)] place-items-center px-5 py-16">
      <div className="max-w-sm text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-[22px] bg-[var(--brand-soft)] text-[var(--brand-deep)]"><WifiOff className="size-7" /></span>
        <h1 className="mt-5 text-2xl font-black tracking-[-0.04em]">인터넷 연결이 없어요</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--sub)]">연결 상태를 확인한 뒤 다시 시도해 주세요. 이전에 본 기본 화면은 오프라인에서도 열 수 있어요.</p>
        <Link href="/" className="mt-6 inline-flex h-12 items-center gap-2 rounded-2xl bg-[var(--brand)] px-5 text-sm font-extrabold text-white"><RefreshCw className="size-4" /> 다시 시도</Link>
      </div>
    </div>
  );
}
