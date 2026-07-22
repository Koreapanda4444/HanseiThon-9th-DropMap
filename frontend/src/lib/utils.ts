import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDistance(distanceM: number | null) {
  if (distanceM === null) return "거리 정보 없음";
  if (distanceM < 1000) return `${distanceM}m`;
  return `${(distanceM / 1000).toFixed(1)}km`;
}

export function formatDateTime(value: string | null) {
  if (!value) return "갱신 시각 정보 없음";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "갱신 시각 정보 없음";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
