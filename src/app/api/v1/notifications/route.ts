import { z } from "zod";
import { api, ok, searchParamsObject } from "@/lib/http";
import { parseInput } from "@/lib/validation";
import { listNotifications } from "@/modules/notifications/service";

/** GET /api/v1/notifications?limit= — newest first (max 100) plus the unread count. */
export const GET = api(async ({ req, ctx }) => {
  const limit = parseInput(z.coerce.number().int().min(1).max(100).default(30), searchParamsObject(req).limit || undefined);
  const r = await listNotifications(ctx, { limit });
  const items = r.items.map((n) => ({ id: n.id, type: n.type, title: n.title, body: n.body, link: n.link, readAt: n.readAt, createdAt: n.createdAt }));
  return ok(items, { unreadCount: r.unreadCount });
});
