import { api, ok, readJson } from "@/lib/http";
import { updateInventory } from "@/modules/inventory/service";
import { ifMatchVersion, pathId } from "../../../_lib/helpers";

/**
 * PATCH /api/v1/merchant/inventory/{inventoryId} —
 * { price?, mrp? (null clears), quantity? | adjust?, untrackQuantity?, stockStatus?, lowStockThreshold?, confirm? }.
 * Optimistic concurrency: send `If-Match: "<version>"` (or body.expectedVersion); a stale version answers 409 CONFLICT.
 * The response carries the new version in the ETag header.
 */
export const PATCH = api<{ inventoryId: string }>(async ({ req, ctx, params }) => {
  const id = pathId(params.inventoryId, "Inventory record");
  const body = await readJson(req);
  const version = ifMatchVersion(req);
  const input = version !== undefined && body && typeof body === "object" ? { ...body, expectedVersion: version } : body;
  const r = await updateInventory(ctx, id, input);
  const res = ok(r);
  res.headers.set("ETag", `"${r.inventory.version}"`);
  return res;
});
