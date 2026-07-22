import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "버릴지도 — 내 주변 수거함 찾기",
    short_name: "버릴지도",
    description: "버릴 물건을 검색하고 내 주변 수거함을 한눈에 찾아보세요.",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f4f7f5",
    theme_color: "#0f9f6e",
    lang: "ko",
    categories: ["navigation", "utilities", "lifestyle"],
    icons: [
      { src: "/icons/app-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icons/app-icon-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
