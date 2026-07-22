import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "버릴지도", template: "%s | 버릴지도" },
  description: "버릴 물건을 검색하고 내 주변 수거함을 한눈에 찾는 지도 서비스",
  applicationName: "버릴지도",
  icons: {
    icon: "/assets/brand-symbol.png",
    apple: "/assets/brand-symbol.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0f9f6e",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
