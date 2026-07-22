import type { NextConfig } from "next";

const development = process.env.NODE_ENV !== "production";

function apiOrigin() {
  try {
    return new URL(process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000").origin;
  } catch {
    return "http://localhost:4000";
  }
}

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${development ? " 'unsafe-eval'" : ""} https://dapi.kakao.com https://t1.daumcdn.net https://*.daumcdn.net https://*.kakaocdn.net`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https:${development ? " http://*.daumcdn.net http://*.daum.net http://*.kakao.com" : ""}`,
  "font-src 'self' data:",
  `connect-src 'self' ${development ? "http:" : apiOrigin()} https://dapi.kakao.com https://*.kakao.com https://*.daum.net https://*.daumcdn.net https://*.kakaocdn.net${development ? " ws: wss:" : ""}`,
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  ...(development ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "Origin-Agent-Cluster", value: "?1" },
  { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=(), payment=(), usb=(), serial=(), bluetooth=()" },
  ...(development ? [] : [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" }]),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
