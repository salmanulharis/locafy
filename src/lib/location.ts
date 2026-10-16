import { cookies } from "next/headers";
import { z } from "zod";
import { DEFAULT_RADIUS_KM, type LatLng } from "@/modules/geo/format";

export const LOCATION_COOKIE = "locafy_loc";

const schema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  label: z.string().max(80),
  radiusKm: z.number().min(1).max(200).default(DEFAULT_RADIUS_KM),
  source: z.enum(["gps", "manual"]).default("manual"),
});

export type SelectedLocation = z.infer<typeof schema>;

export function parseLocationCookie(raw: string | undefined): SelectedLocation | null {
  if (!raw) return null;
  try {
    const parsed = schema.safeParse(JSON.parse(decodeURIComponent(raw)));
    if (!parsed.success || (parsed.data.lat === 0 && parsed.data.lng === 0)) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

/**
 * The customer's selected location (manual or GPS). Not sensitive account
 * data; stored in a cookie so pages render server-side with the right results.
 */
export async function getSelectedLocation(): Promise<SelectedLocation | null> {
  return parseLocationCookie((await cookies()).get(LOCATION_COOKIE)?.value);
}

export function toPoint(loc: SelectedLocation | null): LatLng | null {
  return loc ? { lat: loc.lat, lng: loc.lng } : null;
}
