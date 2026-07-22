import { Gauge, MapPinOff, MapPinned, PencilLine, Wrench, type LucideIcon } from "lucide-react";
import type { ReportType } from "@/types/domain";

export const REPORT_TYPES: Array<{
  id: ReportType;
  label: string;
  description: string;
  color: string;
  icon: LucideIcon;
}> = [
  { id: "full", label: "수거함이 가득 참", description: "더 이상 넣기 어려워요", color: "#f97316", icon: Gauge },
  { id: "missing", label: "수거함이 없음", description: "철거되었거나 찾을 수 없어요", color: "#ef4444", icon: MapPinOff },
  { id: "broken", label: "시설이 고장 남", description: "문이나 투입구가 작동하지 않아요", color: "#8b5cf6", icon: Wrench },
  { id: "location", label: "위치가 다름", description: "지도 좌표와 실제 위치가 달라요", color: "#3b82f6", icon: MapPinned },
  { id: "info", label: "정보 수정", description: "운영시간이나 품목 정보가 달라요", color: "#0f9f6e", icon: PencilLine },
];
