import { sql, type SQL, type AnyColumn } from "drizzle-orm";
import { z } from "zod";

import type { LatLng } from "./format";
export type { LatLng } from "./format";

export const latLngSchema = z
  .object({
    lat: z.coerce.number().min(-90, "Invalid latitude.").max(90, "Invalid latitude."),
    lng: z.coerce.number().min(-180, "Invalid longitude.").max(180, "Invalid longitude."),
  })
  .refine((p) => !(p.lat === 0 && p.lng === 0), { message: "Location has not been set.", path: ["lat"] });

export function isValidLatLng(p: Partial<LatLng> | null | undefined): p is LatLng {
  return latLngSchema.safeParse(p).success;
}

/** geography point literal for queries. */
export function pointSql(p: LatLng): SQL {
  return sql`ST_SetSRID(ST_MakePoint(${p.lng}, ${p.lat}), 4326)::geography`;
}

export function latSql(col: AnyColumn | SQL): SQL<number | null> {
  return sql<number | null>`ST_Y(${col}::geometry)`;
}

export function lngSql(col: AnyColumn | SQL): SQL<number | null> {
  return sql<number | null>`ST_X(${col}::geometry)`;
}

/** Distance in metres from a geography column to a point (null when the column is null). */
export function distanceSql(col: AnyColumn, p: LatLng): SQL<number | null> {
  return sql<number | null>`ST_Distance(${col}, ${pointSql(p)})`;
}

export function withinSql(col: AnyColumn, p: LatLng, metres: number): SQL {
  return sql`ST_DWithin(${col}, ${pointSql(p)}, ${metres})`;
}

export * from "./format";
