import type { NextConfig } from "next";

// Cache Components is intentionally disabled: almost every Locafy page depends on
// the request (session, selected location, live price/stock), and correctness of
// price and availability takes priority over caching. See docs/decisions.md.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
];

const nextConfig: NextConfig = {
  cacheComponents: false,
  poweredByHeader: false,
  // Uploads are limited to 5 MB by the media service; allow multipart overhead.
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
  serverExternalPackages: ["@node-rs/argon2", "sharp"],
  images: {
    // Uploaded media is served from /media (local driver) or a configured remote host.
    localPatterns: [{ pathname: "/media/**" }, { pathname: "/icons/**" }],
    remotePatterns: process.env.STORAGE_PUBLIC_HOST
      ? [{ protocol: "https", hostname: process.env.STORAGE_PUBLIC_HOST }]
      : [],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
