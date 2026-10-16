"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Crosshair, Loader2, MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Select } from "@/components/ui/form";
import { Alert } from "@/components/ui/primitives";
import { useToast } from "@/components/feedback/toaster";
import { DEFAULT_RADIUS_KM, RADIUS_OPTIONS_KM } from "@/modules/geo/format";
import { cn } from "@/lib/cn";

export type ClientLocation = { lat: number; lng: number; label: string; radiusKm: number; source: "gps" | "manual" };
type Place = { label: string; detail: string | null; lat: number; lng: number };

const COOKIE = "locafy_loc";

export function saveLocationCookie(loc: ClientLocation | null) {
  if (!loc) {
    document.cookie = `${COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
    return;
  }
  const value = encodeURIComponent(JSON.stringify(loc));
  document.cookie = `${COOKIE}=${value}; Path=/; Max-Age=${60 * 60 * 24 * 180}; SameSite=Lax`;
}

/** Location chip + dialog. Precise location is optional; manual search is first-class. */
export function LocationPicker({ current, className, variant = "chip" }: { current: ClientLocation | null; className?: string; variant?: "chip" | "button" }) {
  return (
    <Dialog
      title="Choose your location"
      description="Results are sorted by distance from this place. Your location is stored only on this device."
      trigger={(open) =>
        variant === "chip" ? (
          <button
            type="button"
            onClick={open}
            className={cn("inline-flex h-9 max-w-[14rem] items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-sm font-medium text-fg hover:bg-surface-2", className)}
            aria-label={current ? `Location: ${current.label}. Change location` : "Set your location"}
          >
            <MapPin className="size-4 shrink-0 text-primary" aria-hidden />
            <span className="truncate">{current ? current.label : "Set location"}</span>
          </button>
        ) : (
          <Button variant="outline" onClick={open} icon={<MapPin className="size-4" aria-hidden />} className={className}>
            {current ? `Near ${current.label}` : "Set your location"}
          </Button>
        )
      }
    >
      {(close) => <LocationPanel current={current} onDone={close} />}
    </Dialog>
  );
}

function LocationPanel({ current, onDone }: { current: ClientLocation | null; onDone: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gpsState, setGpsState] = useState<"idle" | "locating" | "denied" | "unavailable">("idle");
  const [radius, setRadius] = useState(current?.radiusKm ?? DEFAULT_RADIUS_KM);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    clearTimeout(timer.current);
    if (q.trim().length < 2) return;
    timer.current = setTimeout(async () => {
      setSearching(true);
      setError(null);
      try {
        const res = await fetch(`/api/v1/locations/search?q=${encodeURIComponent(q.trim())}`);
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error?.message ?? "Search failed");
        setResults(body.data.results);
        if (!body.data.results.length) setError("No matching places. Try a town name or postal code.");
      } catch (e) {
        setError((e as Error).message || "Location search is unavailable right now.");
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer.current);
  }, [q]);

  function apply(loc: ClientLocation) {
    saveLocationCookie(loc);
    toast({ tone: "success", message: `Showing results near ${loc.label}` });
    onDone();
    router.refresh();
  }

  function useGps() {
    if (!("geolocation" in navigator)) {
      setGpsState("unavailable");
      return;
    }
    setGpsState("locating");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(5));
        const lng = Number(pos.coords.longitude.toFixed(5));
        let label = "Current location";
        try {
          const res = await fetch(`/api/v1/locations/reverse?lat=${lat}&lng=${lng}`);
          const body = await res.json();
          if (res.ok && body.data?.label) label = `Near ${body.data.label}`;
        } catch {
          // keep generic label
        }
        setGpsState("idle");
        apply({ lat, lng, label, radiusKm: radius, source: "gps" });
      },
      (err) => setGpsState(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable"),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Button variant="soft" onClick={useGps} loading={gpsState === "locating"} icon={<Crosshair className="size-4" aria-hidden />}>
        Use my current location
      </Button>
      {gpsState === "denied" && (
        <Alert tone="info">Location permission was denied. You can still search for your town, locality or postal code below.</Alert>
      )}
      {gpsState === "unavailable" && <Alert tone="warning">We couldn&apos;t get your position. Search for a place instead.</Alert>}

      <div className="relative">
        <label htmlFor="place-search" className="sr-only">
          Search town, locality or postal code
        </label>
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <Input
          id="place-search"
          type="search"
          inputMode="search"
          autoComplete="off"
          placeholder="Town, locality or postal code"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-9"
        />
        {searching && <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted" aria-hidden />}
      </div>

      {error && q.trim().length >= 2 && <p className="text-sm text-muted">{error}</p>}
      {results.length > 0 && q.trim().length >= 2 && (
        <ul className="-mx-2 flex flex-col" role="listbox" aria-label="Matching places">
          {results.map((r) => (
            <li key={`${r.label}-${r.lat}-${r.lng}`}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => apply({ lat: r.lat, lng: r.lng, label: r.label, radiusKm: radius, source: "manual" })}
                className="flex min-h-11 w-full items-start gap-3 rounded-lg px-2 py-2 text-left hover:bg-surface-2"
              >
                <MapPin className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
                <span className="min-w-0">
                  <span className="block font-medium">{r.label}</span>
                  {r.detail && <span className="block truncate text-sm text-muted">{r.detail}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
        <label htmlFor="radius" className="text-sm font-medium">
          Search radius
        </label>
        <Select
          id="radius"
          value={radius}
          onChange={(e) => {
            const r = Number(e.target.value);
            setRadius(r);
            if (current) apply({ ...current, radiusKm: r });
          }}
          className="w-32"
        >
          {RADIUS_OPTIONS_KM.map((r) => (
            <option key={r} value={r}>
              {r} km
            </option>
          ))}
        </Select>
      </div>
      {current && (
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => {
            saveLocationCookie(null);
            onDone();
            router.refresh();
          }}
        >
          Clear location
        </Button>
      )}
    </div>
  );
}
