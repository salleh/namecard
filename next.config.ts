import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  async headers() {
    // Baseline hardening for the public, unauthenticated card pages. (A strict
    // CSP is deferred: the card page uses inline styles, so it would need
    // style-src 'unsafe-inline' — revisit alongside a styling refactor.)
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
  async rewrites() {
    // beforeFiles so `/<slug>.vcf` is routed to the vcf handler BEFORE the
    // [slug] page would otherwise capture it as a single segment.
    return {
      beforeFiles: [{ source: "/:slug.vcf", destination: "/vcf/:slug" }],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default withSerwist(nextConfig);
