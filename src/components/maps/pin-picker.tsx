"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MlMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Crosshair } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form";
import { Alert } from "@/components/ui/primitives";
import { BRAND } from "@/lib/brand";

const STYLE_URL = process.env.NEXT_PUBLIC_MAP_STYLE_URL || "https://tiles.openfreemap.org/styles/liberty";

/**
 * Merchant shop-location picker. The pin can be placed by tapping the map,
 * dragging, using device location, or typing coordinates (keyboard/no-WebGL
 * fallback). Writes hidden `lat` / `lng` inputs for the enclosing form.
 */
export function PinPicker({ initial, fallbackCenter }: { initial: { lat: number; lng: number } | null; fallbackCenter?: { lat: number; lng: number } }) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(initial);
  const [mapFailed, setMapFailed] = useState(false);
  const [gpsMsg, setGpsMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ml = await import("maplibre-gl");
        if (cancelled || !container.current) return;
        const c = initial ?? fallbackCenter ?? { lat: 10.0, lng: 76.3 };
        const map = new ml.Map({ container: container.current, style: STYLE_URL, center: [c.lng, c.lat], zoom: initial ? 16 : 12, attributionControl: { compact: true } });
        map.addControl(new ml.NavigationControl({ showCompass: false }), "top-right");
        const marker = new ml.Marker({ draggable: true, color: BRAND.primary });
        if (initial) marker.setLngLat([initial.lng, initial.lat]).addTo(map);
        marker.on("dragend", () => {
          const l = marker.getLngLat();
          setPos({ lat: round(l.lat), lng: round(l.lng) });
        });
        map.on("click", (e) => {
          marker.setLngLat(e.lngLat).addTo(map);
          setPos({ lat: round(e.lngLat.lat), lng: round(e.lngLat.lng) });
        });
        map.on("error", () => {
          if (!map.loaded()) setMapFailed(true);
        });
        mapRef.current = map;
        markerRef.current = marker;
      } catch {
        setMapFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function moveTo(p: { lat: number; lng: number }) {
    setPos(p);
    if (mapRef.current && markerRef.current) {
      markerRef.current.setLngLat([p.lng, p.lat]).addTo(mapRef.current);
      mapRef.current.flyTo({ center: [p.lng, p.lat], zoom: 16 });
    }
  }

  function gps() {
    setGpsMsg(null);
    if (!("geolocation" in navigator)) return setGpsMsg("Device location is not available in this browser.");
    navigator.geolocation.getCurrentPosition(
      (p) => moveTo({ lat: round(p.coords.latitude), lng: round(p.coords.longitude) }),
      () => setGpsMsg("Couldn't read your location. Tap the map to place the pin instead."),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name="lat" value={pos?.lat ?? ""} />
      <input type="hidden" name="lng" value={pos?.lng ?? ""} />
      {!mapFailed ? (
        <div ref={container} className="h-72 overflow-hidden rounded-xl border border-border bg-surface-2" role="region" aria-label="Map: tap to place your shop location" />
      ) : (
        <Alert tone="warning">The map couldn&apos;t load. Use your device location or enter the coordinates below.</Alert>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <Button variant="outline" size="sm" onClick={gps} icon={<Crosshair className="size-4" aria-hidden />}>
          Use my current location
        </Button>
        <p className="text-sm text-muted" aria-live="polite">
          {pos ? `Pin at ${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}` : "No location selected yet"}
        </p>
      </div>
      {gpsMsg && <p className="text-sm text-warning-soft-fg">{gpsMsg}</p>}
      <details className="text-sm">
        <summary className="cursor-pointer text-muted">Enter coordinates manually</summary>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="lat-manual">Latitude</Label>
            <Input id="lat-manual" inputMode="decimal" defaultValue={pos?.lat ?? ""} onBlur={(e) => { const v = Number(e.target.value); if (Number.isFinite(v) && pos) moveTo({ ...pos, lat: v }); else if (Number.isFinite(v)) setPos({ lat: v, lng: pos?.lng ?? 0 }); }} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="lng-manual">Longitude</Label>
            <Input id="lng-manual" inputMode="decimal" defaultValue={pos?.lng ?? ""} onBlur={(e) => { const v = Number(e.target.value); if (Number.isFinite(v) && pos) moveTo({ ...pos, lng: v }); else if (Number.isFinite(v)) setPos({ lat: pos?.lat ?? 0, lng: v }); }} />
          </div>
        </div>
      </details>
    </div>
  );
}

function round(n: number) {
  return Number(n.toFixed(6));
}
