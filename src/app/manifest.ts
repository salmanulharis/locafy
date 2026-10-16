import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";

/**
 * Installable web app manifest. No service worker is registered on purpose:
 * caching search or stock responses offline could show outdated availability
 * as current. See docs/decisions.md.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Locafy — find products in shops near you",
    short_name: "Locafy",
    description: "Search for a product, compare prices at nearby shops and get directions.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: BRAND.background,
    theme_color: BRAND.primary,
    categories: ["shopping", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Search", url: "/search" },
      { name: "Saved", url: "/saved" },
      { name: "My shops", url: "/merchant" },
    ],
  };
}
