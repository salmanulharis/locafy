/** Client-safe geo helpers (no database imports). */

export type LatLng = { lat: number; lng: number };

/** Great-circle distance in metres (used client-side and in tests; PostGIS is authoritative). */
export function haversineMetres(a: LatLng, b: LatLng): number {
  const R = 6_371_008.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatDistance(metres: number | null | undefined): string | null {
  if (metres == null || !Number.isFinite(metres)) return null;
  // Round to 50 m first so 975–999 m reads "1.0 km", not "1000 m".
  const rounded = Math.max(50, Math.round(metres / 50) * 50);
  if (rounded < 1000) return `${rounded} m`;
  if (metres < 10_000) return `${(metres / 1000).toFixed(1)} km`;
  return `${Math.round(metres / 1000)} km`;
}

/** External directions link. Locafy never computes or fabricates routes itself. */
export function directionsUrl(dest: LatLng, origin?: LatLng | null): string {
  const params = new URLSearchParams({ api: "1", destination: `${dest.lat},${dest.lng}` });
  if (origin) params.set("origin", `${origin.lat},${origin.lng}`);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export const RADIUS_OPTIONS_KM = [2, 5, 10, 25, 50] as const;
export const DEFAULT_RADIUS_KM = 10;
