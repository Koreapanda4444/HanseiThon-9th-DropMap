import Link from "next/link";
import { ArrowLeft, MapPinOff } from "lucide-react";

export default function NotFound() {
  return (
    <div className="grid min-h-[calc(100dvh-138px)] place-items-center px-5 py-16 lg:min-h-[calc(100dvh-68px)]">
      <div className="max-w-sm text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-[22px] bg-[var(--brand-soft)] text-[var(--brand-deep)]"><MapPinOff className="size-7" /></span>
        <p className="mt-5 text-[12px] font-extrabold text-[var(--brand-deep)]">404 · NOT FOUND</p>
        <h1 className="mt-1 text-[24px] font-black tracking-[-0.045em]">장소를 찾을 수 없어요</h1>
        <p className="mt-2 text-[13px] leading-6 text-[var(--sub)]">주소가 바뀌었거나 지도에서 삭제된 장소일 수 있어요.</p>
        <Link href="/" className="mt-6 inline-flex h-12 items-center gap-2 rounded-2xl bg-[var(--brand)] px-5 text-[13px] font-extrabold text-white"><ArrowLeft className="size-4" /> 지도로 돌아가기</Link>
      </div>
    </div>
  );
}
