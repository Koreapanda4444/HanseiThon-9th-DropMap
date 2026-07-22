import { CircleCheck, Clock3, TriangleAlert } from "lucide-react";
import type { FacilityStatus } from "@/types/domain";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<FacilityStatus, string> = {
  available: "bg-emerald-50 text-emerald-700",
  busy: "bg-amber-50 text-amber-700",
  unavailable: "bg-rose-50 text-rose-700",
};

export function StatusBadge({ status, label, className }: { status: FacilityStatus; label: string; className?: string }) {
  const Icon = status === "available" ? CircleCheck : status === "busy" ? Clock3 : TriangleAlert;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-bold", STATUS_STYLES[status], className)}>
      <Icon className="size-3.5" />
      {label}
    </span>
  );
}
