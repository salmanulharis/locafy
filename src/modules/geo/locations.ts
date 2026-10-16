import { sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { localities } from "@/db/schema";
import { env } from "@/lib/env";
import { parseInput } from "@/lib/validation";
import type { Ctx } from "@/modules/auth/context";
import { enforceRateLimit } from "@/modules/platform/rate-limit";
import { latSql, lngSql, pointSql, type LatLng } from "./geo";

export type PlaceResult = {
  label: string;
  detail: string | null;
  lat: number;
  lng: number;
  source: "locality" | "geocoder";
};

const querySchema = z.object({ q: z.string().trim().min(2, "Type at least 2 characters.").max(120) });

/**
 * Manual location search: built-in localities first (fast, no external
 * dependency), then the configured Nominatim-compatible geocoder. External
 * failures degrade gracefully to locality-only results.
 */
export async function searchPlaces(ctx: Ctx, input: unknown): Promise<{ results: PlaceResult[]; geocoderAvailable: boolean }> {
  const { q } = parseInput(querySchema, input);
  const local = await searchLocalities(q);
  const e = env();
  if (!e.GEOCODER_URL || local.length >= 5) return { results: local, geocoderAvailable: Boolean(e.GEOCODER_URL) };

  await enforceRateLimit("geocode", ctx.ip);
  try {
    const remote = await geocode(q);
    const seen = new Set(local.map((r) => r.label.toLowerCase()));
    return {
      results: [...local, ...remote.filter((r) => !seen.has(r.label.toLowerCase()))].slice(0, 8),
      geocoderAvailable: true,
    };
  } catch {
    return { results: local, geocoderAvailable: false };
  }
}

export async function searchLocalities(q: string): Promise<PlaceResult[]> {
  const term = q.toLowerCase();
  const isPostal = /^\d{3,10}$/.test(q.replace(/\s/g, ""));
  const rows = await getDb()
    .select({
      name: localities.name,
      district: localities.district,
      region: localities.region,
      lat: latSql(localities.location),
      lng: lngSql(localities.location),
    })
    .from(localities)
    .where(
      isPostal
        ? sql`${localities.postalCode} = ${q.replace(/\s/g, "")}`
        : sql`lower(${localities.name}) like ${term + "%"} or lower(${localities.name}) % ${term}`,
    )
    .orderBy(sql`similarity(lower(${localities.name}), ${term}) desc`, sql`${localities.population} desc nulls last`)
    .limit(6);
  return rows.map((r) => ({
    label: r.name,
    detail: [r.district, r.region].filter(Boolean).join(", ") || null,
    lat: r.lat!,
    lng: r.lng!,
    source: "locality" as const,
  }));
}

async function geocode(q: string): Promise<PlaceResult[]> {
  const e = env();
  const url = new URL("/search", e.GEOCODER_URL);
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "5");
  url.searchParams.set("countrycodes", e.DEFAULT_COUNTRY_CODE);
  if (e.GEOCODER_CONTACT_EMAIL) url.searchParams.set("email", e.GEOCODER_CONTACT_EMAIL);
  const res = await fetch(url, {
    headers: { "User-Agent": `Locafy/0.1 (${e.GEOCODER_CONTACT_EMAIL || "dev"})`, Accept: "application/json" },
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`Geocoder HTTP ${res.status}`);
  const data = (await res.json()) as { display_name: string; name?: string; lat: string; lon: string }[];
  return data
    .map((d) => {
      const [first, ...rest] = d.display_name.split(",").map((s) => s.trim());
      return {
        label: d.name || first || d.display_name,
        detail: rest.slice(0, 3).join(", ") || null,
        lat: Number(d.lat),
        lng: Number(d.lon),
        source: "geocoder" as const,
      };
    })
    .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng));
}

/** Nearest known locality name for a coordinate (used to label GPS locations). */
export async function nearestLocalityName(p: LatLng): Promise<string | null> {
  const rows = await getDb()
    .select({ name: localities.name })
    .from(localities)
    .where(sql`ST_DWithin(${localities.location}, ${pointSql(p)}, 30000)`)
    .orderBy(sql`${localities.location} <-> ${pointSql(p)}`)
    .limit(1);
  return rows[0]?.name ?? null;
}
