import type { NextConfig } from "next";
import { resolve } from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: resolve(__dirname),
  },
  reactCompiler: true,
  experimental: {
    // React's <ViewTransition>: page navigations, Suspense reveals and list
    // changes run through the browser's View Transitions API.
    viewTransition: true,
  },
  images: {
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
