import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { isAppError } from "@/lib/errors";
import { getCtx, type Ctx } from "@/modules/auth/context";
import { listCategories } from "@/modules/catalog/service";
import { getMerchantShop } from "@/modules/shops/service";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(v: string) {
  return UUID.test(v);
}

/** Request context, deduplicated across layout + page in one render. */
export const merchantCtx = cache(() => getCtx());

/** Signed-in context or redirect to login, returning to `path` afterwards. */
export async function requireMerchant(path: string): Promise<Ctx & { actor: NonNullable<Ctx["actor"]> }> {
  const ctx = await merchantCtx();
  if (!ctx.actor) redirect(`/login?next=${encodeURIComponent(path)}`);
  return ctx as Ctx & { actor: NonNullable<Ctx["actor"]> };
}

/** Load a shop the caller is a member of; non-members (and bad ids) get a 404. */
export const loadShop = cache(async (shopId: string) => {
  if (!isUuid(shopId)) notFound();
  const ctx = await merchantCtx();
  return guard(getMerchantShop(ctx, shopId));
});

/** Turn NOT_FOUND service errors into the Next.js 404 page. */
export async function guard<T>(p: Promise<T>): Promise<T> {
  try {
    return await p;
  } catch (e) {
    if (isAppError(e) && e.code === "NOT_FOUND") notFound();
    throw e;
  }
}

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export function sp(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** Product-scope categories grouped under their top-level parent, for <optgroup> selects. */
export async function productCategoryGroups() {
  const cats = await listCategories({ scope: "product" });
  const top = cats.filter((c) => !c.parentId);
  const groups = top.map((t) => {
    const children = cats.filter((c) => c.parentId === t.id);
    return {
      label: t.name,
      options: children.length ? children.map((c) => ({ value: c.id, label: c.name })) : [{ value: t.id, label: t.name }],
    };
  });
  // Children whose parent is not product-scoped still need to be selectable.
  const orphans = cats.filter((c) => c.parentId && !top.some((t) => t.id === c.parentId));
  if (orphans.length) groups.push({ label: "Other", options: orphans.map((c) => ({ value: c.id, label: c.name })) });
  return groups;
}
