import {
  BatteryCharging,
  Cigarette,
  PlugZap,
  Pill,
  Recycle,
  Shirt,
  Trash2,
  type LucideProps,
} from "lucide-react";
import type { FacilityCategoryId } from "@/types/domain";

const ICONS = {
  general: Trash2,
  recycle: Recycle,
  medicine: Pill,
  battery: BatteryCharging,
  clothes: Shirt,
  cigarette: Cigarette,
  electronics: PlugZap,
} satisfies Record<FacilityCategoryId, React.ComponentType<LucideProps>>;

export function CategoryIcon({ categoryId, ...props }: LucideProps & { categoryId: FacilityCategoryId }) {
  const Icon = ICONS[categoryId];
  return <Icon aria-hidden="true" {...props} />;
}
