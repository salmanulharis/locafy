import { sql, type SQL } from "drizzle-orm";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Bind a list of UUIDs as a single `uuid[]` parameter. (Drizzle expands JS
 * arrays inside `sql` templates into `($1, $2…)`, which `= any()` cannot use.)
 */
export function uuidArray(ids: string[]): SQL {
  for (const id of ids) if (!UUID_RE.test(id)) throw new Error("Invalid uuid in array parameter");
  return sql`${`{${ids.join(",")}}`}::uuid[]`;
}
