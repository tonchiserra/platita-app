import type { NextConfig } from "next";
import { resolve } from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: resolve(__dirname),
  },
  reactCompiler: true,
  images: {
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
