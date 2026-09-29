import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.VOYAJ_BUILD_DIR || ".next",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.cloudfront.net" },
      { protocol: "https", hostname: "platform.higgsfield.ai" },
    ],
  },
  experimental: {
    // Allow importing JSON files with assert
  },
};

export default nextConfig;
