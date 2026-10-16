import { api, ok, readJson } from "@/lib/http";
import { listFavourites, setFavourite } from "@/modules/favourites/service";

/** GET /api/v1/favourites — saved products and shops. */
export const GET = api(async ({ ctx }) => ok(await listFavourites(ctx)));

/** PUT /api/v1/favourites — { kind: product|shop, id, saved } (idempotent). */
export const PUT = api(async ({ req, ctx }) => ok(await setFavourite(ctx, await readJson(req))));
