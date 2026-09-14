import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Don't use standalone output on Vercel — it handles deployment itself
  // Only use standalone for Electron desktop builds
  ...(process.env.DEPLOY_TARGET === "electron"
    ? { output: "standalone" as const }
    : {}),
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Mark native/external packages that shouldn't be bundled
  serverExternalPackages: ["bcryptjs", "@prisma/client", "prisma"],
  // Prisma needs to generate on build
  experimental: {
    // Allow Prisma to work in serverless
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
