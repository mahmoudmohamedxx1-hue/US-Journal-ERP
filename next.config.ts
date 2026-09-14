import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Only use standalone output for Electron desktop builds
  ...(process.env.DEPLOY_TARGET === "electron"
    ? { output: "standalone" as const }
    : {}),
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  reactStrictMode: false,
  serverExternalPackages: ["bcryptjs", "@prisma/client"],
};

export default nextConfig;
