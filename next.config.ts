import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: true },
  serverExternalPackages: ["pg", "drizzle-orm", "bcryptjs", "smpp"],
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
    // instrumentation.ts auto-loaded in Next.js 16
  },
  env: {
    SMPP_PORT: process.env.SMPP_PORT || "2775",
  },
};

export default nextConfig;
