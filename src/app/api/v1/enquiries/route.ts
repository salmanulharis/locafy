import { api, ok, readJson } from "@/lib/http";
import { createEnquiry, listMyEnquiries } from "@/modules/enquiries/service";
import { created } from "../_lib/helpers";

/** GET /api/v1/enquiries — the caller's enquiries as a customer (latest activity first, max 100). */
export const GET = api(async ({ ctx }) => {
  const items = await listMyEnquiries(ctx);
  return ok(items, { total: items.length });
});

/**
 * POST /api/v1/enquiries — { shopId, listingId?, quantity?, message }.
 * Send `Idempotency-Key: <≤64 chars>` to make retries safe: a repeated key returns the original enquiry.
 */
export const POST = api(async ({ req, ctx }) => {
  const body = await readJson(req);
  const key = req.headers.get("idempotency-key")?.trim();
  const input = key && body && typeof body === "object" ? { ...body, clientRequestId: key } : body;
  return ok(await createEnquiry(ctx, input), undefined, created);
});
