import type { NextConfig } from "next";

// ── Security headers applied to ALL responses ──
const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com https://embed.tawk.to https://va.tawk.to",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://ipapi.co https://*.tawk.to wss://*.tawk.to",
      "frame-src 'self' https://embed.tawk.to",
      "media-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
  { key: "X-XSS-Protection", value: "1; mode=block" },
];

const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: true },
  serverExternalPackages: ["pg", "drizzle-orm", "bcryptjs", "smpp"],
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
  },
  env: {
    SMPP_PORT: process.env.SMPP_PORT || "2775",
    NEXT_PUBLIC_TAWKTO_ID: process.env.NEXT_PUBLIC_TAWKTO_ID || "",
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/dashboard/sms-translations",
        destination: "/dashboard/translations/sid",
        permanent: true,
      },
      {
        source: "/dashboard/translations",
        destination: "/dashboard/translations/sid",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
