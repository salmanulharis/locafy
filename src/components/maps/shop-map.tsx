"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MlMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapPinOff } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/cn";

export type MapMarker = { id: string; lat: number; lng: number; title: string; subtitle?: string; href?: string };

const STYLE_URL = process.env.NEXT_PUBLIC_MAP_STYLE_URL || "https://tiles.openfreemap.org/styles/liberty";

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/**
 * Interactive map of shop locations. Lazily loads MapLibre; if tiles or WebGL
 * fail, shows a clear fallback (the list view remains the primary UI).
 */
export function ShopMap({ markers, center, className, label = "Map of shop locations" }: { markers: MapMarker[]; center?: { lat: number; lng: number } | null; className?: string; label?: string }) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const markerRefs = useRef<Marker[]>([]);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ml = await import("maplibre-gl");
        if (cancelled || !container.current || mapRef.current) return;
        const first = center ?? markers[0] ?? { lat: 20.5937, lng: 78.9629 };
        const map = new ml.Map({
          container: container.current,
          style: STYLE_URL,
          center: [first.lng, first.lat],
          zoom: center || markers.length ? 12 : 4,
          attributionControl: { compact: true },
          cooperativeGestures: true,
        });
        map.addControl(new ml.NavigationControl({ showCompass: false }), "top-right");
        map.on("error", (e) => {
          // Tile/style failures: keep the map if it rendered, otherwise show fallback.
          if (!map.loaded() && /style|Failed to fetch/i.test(String(e.error?.message ?? ""))) setFailed(true);
        });
        mapRef.current = map;
        setReady(true);
      } catch {
        setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      const map = mapRef.current;
      if (!map) return;
      const ml = await import("maplibre-gl");
      markerRefs.current.forEach((m) => m.remove());
      markerRefs.current = [];
      const bounds = new ml.LngLatBounds();
      if (center) {
        const el = document.createElement("div");
        el.className = "size-3.5 rounded-full border-2 border-white bg-fg shadow";
        el.setAttribute("aria-label", "Your selected location");
        markerRefs.current.push(new ml.Marker({ element: el }).setLngLat([center.lng, center.lat]).addTo(map));
        bounds.extend([center.lng, center.lat]);
      }
      for (const m of markers) {
        const html = `<div style="font:500 13px/1.35 system-ui"><strong>${escapeHtml(m.title)}</strong>${m.subtitle ? `<br/><span style="color:${BRAND.muted}">${escapeHtml(m.subtitle)}</span>` : ""}${m.href ? `<br/><a href="${encodeURI(m.href)}" style="color:${BRAND.primary}">View</a>` : ""}</div>`;
        const marker = new ml.Marker({ color: BRAND.primary })
          .setLngLat([m.lng, m.lat])
          .setPopup(new ml.Popup({ offset: 24, closeButton: true }).setHTML(html))
          .addTo(map);
        marker.getElement().setAttribute("aria-label", m.title);
        markerRefs.current.push(marker);
        bounds.extend([m.lng, m.lat]);
      }
      if (!bounds.isEmpty() && markers.length + (center ? 1 : 0) > 1) map.fitBounds(bounds, { padding: 48, maxZoom: 15, duration: 0 });
    })();
  }, [markers, center, ready]);

  if (failed) {
    return (
      <div className={cn("flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-surface-2 p-6 text-center text-sm text-muted", className)}>
        <MapPinOff className="size-6" aria-hidden />
        <p>The map couldn&apos;t be loaded right now. Shop addresses and directions are still available in the list.</p>
      </div>
    );
  }
  return <div ref={container} role="region" aria-label={label} className={cn("overflow-hidden rounded-xl border border-border bg-surface-2", className)} />;
}
