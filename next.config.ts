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
  // Trading used to be a tab inside Inversiones. Old bookmarks land on its own section.
  async redirects() {
    return [{ source: "/dashboard/investments/trading", destination: "/dashboard/trading", permanent: true }];
  },
};

export default nextConfig;
