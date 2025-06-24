import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  basePath: '/apps/kokoro-tts',
  assetPrefix: '/apps/kokoro-tts',
  trailingSlash: false,
};

export default nextConfig;
