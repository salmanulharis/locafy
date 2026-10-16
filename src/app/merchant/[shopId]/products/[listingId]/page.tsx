import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive, ExternalLink, Info, Lock, PauseCircle, Trash2 } from "lucide-react";
import { SubmitButton } from "@/components/forms/action-form";
import { MerchantForm } from "@/components/merchant/merchant-form";
import { ConfirmAction } from "@/components/forms/confirm-action";
import { SelectField, TextAreaField, TextField } from "@/components/forms/fields";
import { ImageUpload } from "@/components/merchant/image-upload";
import { BackLink, formatDateTime, productTitle } from "@/components/merchant/misc";
import { ProductFields } from "@/components/merchant/product-fields";
import { ListingStatusBadge, StaleBadge, StockBadge } from "@/components/merchant/status";
import { STOCK_STATUS_OPTIONS } from "@/components/merchant/stock-fields";
import { relativeTime } from "@/components/products/availability";
import { ProductImage } from "@/components/products/product-image";
import { Checkbox } from "@/components/ui/form";
import { Alert, Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { formatMoney, toMajorInput } from "@/lib/money";
import { roleAllows } from "@/modules/access/permissions";
import { STALE_AFTER_DAYS, STOCK_LABELS, stockFreshness, type StockStatus } from "@/modules/inventory/rules";
import { allowedActions, type ListingAction, type ListingStatus } from "@/modules/listings/rules";
import { getMerchantListing } from "@/modules/listings/service";
import { guard, isUuid, loadShop, merchantCtx, productCategoryGroups, requireMerchant, sp, type SearchParams } from "../../../_lib/data";
import {
  addBranchStockAction,
  changeListingStatusAction,
  confirmStockAction,
  removeListingPhotoAction,
  updateInventoryAction,
  updateListingAction,
  uploadListingPhotoAction,
} from "../actions";

export const metadata: Metadata = { title: "Product" };

const ACTION_LABELS: Record<ListingAction, string> = {
  publish: "Publish",
  unpublish: "Unpublish",
  archive: "Archive",
  discontinue: "Mark discontinued",
  restore: "Restore as draft",
};

export default async function ListingPage({ params, searchParams }: { params: Promise<{ shopId: string; listingId: string }>; searchParams: SearchParams }) {
  const { shopId, listingId } = await params;
  const q = await searchParams;
  await requireMerchant(`/merchant/${shopId}/products/${listingId}`);
  if (!isUuid(listingId)) notFound();
  const ctx = await merchantCtx();
  const { shop, role } = await loadShop(shopId);
  const data = await guard(getMerchantListing(ctx, listingId));
  if (data.listing.shopId !== shopId) notFound();
  const { listing, product, stock, images, history, branches, editableCatalog } = data;
  const status = listing.status as ListingStatus;
  const base = `/merchant/${shopId}`;
  const planHref = `${base}/plan`;
  const suspended = shop.status === "suspended";
  const canManage = roleAllows(role, "listing.manage") && !suspended;
  const canStock = roleAllows(role, "inventory.update") && !suspended;
  const canUpload = roleAllows(role, "media.upload") && canManage;
  const title = productTitle(product.brand, product.p.name);
  const missingBranches = branches.filter((b) => !stock.some((s) => s.branchId === b.id));
  const actions = canManage ? allowedActions(status) : [];
  const created = sp(q.created);
  const groups = editableCatalog && canManage ? await productCategoryGroups() : [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        back={<BackLink href={`${base}/products`}>Products</BackLink>}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {title}
            <ListingStatusBadge status={status} />
          </span>
        }
        description={[product.p.model, product.p.variant, product.category].filter(Boolean).join(" · ") || undefined}
        actions={
          status === "published" && shop.status === "active" ? (
            <Link href={`/p/${product.p.slug}`} className="inline-flex h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-primary hover:bg-surface-2">
              View public page <ExternalLink className="size-4" aria-hidden />
            </Link>
          ) : undefined
        }
      />

      {created === "published" && <Alert tone="success">Product published. Customers nearby can now find it.</Alert>}
      {created === "draft" && <Alert tone="success">Saved as a draft. Publish it when you&apos;re ready{shop.status !== "active" ? " — after your shop is approved" : ""}.</Alert>}
      {status === "restricted" && (
        <Alert tone="danger" title="Restricted by a moderator">
          {listing.restrictedReason ? `Reason: “${listing.restrictedReason}”. ` : ""}This listing is hidden from customers. Contact Locafy support if you think this is a mistake.
        </Alert>
      )}
      {product.p.status === "restricted" && status !== "restricted" && (
        <Alert tone="danger" title="This product is restricted on Locafy">It can&apos;t be published by any shop.</Alert>
      )}
      {suspended && <Alert tone="danger">Your shop is suspended, so this product can&apos;t be changed.</Alert>}

      {actions.length > 0 && (
        <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">
            {status === "published" && "Visible to customers in search and on your shop page."}
            {status === "draft" && "Draft — only your team can see it."}
            {status === "unpublished" && "Hidden from customers. Publish again any time."}
            {status === "discontinued" && "Shown as discontinued; customers can't enquire."}
            {status === "archived" && "Archived — hidden and not counted towards your plan."}
          </p>
          <div className="flex flex-wrap gap-2">
            {actions.map((a) =>
              a === "archive" || a === "discontinue" ? (
                <ConfirmAction
                  key={a}
                  action={changeListingStatusAction.bind(null, listingId, a)}
                  label={ACTION_LABELS[a]}
                  size="md"
                  icon={a === "archive" ? <Archive className="size-4" aria-hidden /> : <PauseCircle className="size-4" aria-hidden />}
                  title={a === "archive" ? "Archive this product?" : "Mark as discontinued?"}
                  description={
                    a === "archive"
                      ? "It will be hidden from customers and won't count towards your plan. You can restore it later as a draft."
                      : "Use this when you no longer sell the product. Customers will no longer see it as available."
                  }
                  confirmLabel={ACTION_LABELS[a]}
                />
              ) : (
                <MerchantForm key={a} action={changeListingStatusAction.bind(null, listingId, a)} className="gap-0" planHref={planHref}>
                  <SubmitButton variant={a === "publish" ? "primary" : "outline"}>{ACTION_LABELS[a]}</SubmitButton>
                </MerchantForm>
              ),
            )}
          </div>
        </Card>
      )}

      <section aria-labelledby="stock-h" className="flex flex-col gap-3">
        <div>
          <h2 id="stock-h" className="text-heading font-semibold">
            Price & stock
          </h2>
          <p className="text-sm text-muted">
            Customers see when stock was last updated. Items not updated for {STALE_AFTER_DAYS} days are marked “may be outdated”.
          </p>
        </div>
        {stock.map((s) => {
          const freshness = stockFreshness(s.stockUpdatedAt);
          const tracked = s.quantity != null;
          const st = s.stockStatus as StockStatus;
          return (
            <Card key={s.id} className="p-4">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <h3 className="font-semibold">{s.branchName}</h3>
                <StockBadge status={st} quantity={s.quantity} />
                {freshness === "stale" && <StaleBadge />}
                <span className="text-xs text-muted">
                  {formatMoney(s.priceMinor, s.currency)} · stock updated {relativeTime(s.stockUpdatedAt)}
                </span>
              </div>
              {canStock ? (
                <div className="flex flex-col gap-4">
                  <MerchantForm key={`inv-${s.id}-${s.version}`} action={updateInventoryAction.bind(null, s.id, s.version)} planHref={planHref}>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <TextField id={`price-${s.id}`} name="price" label="Selling price (₹)" inputMode="decimal" defaultValue={toMajorInput(s.priceMinor)} required />
                      <TextField id={`mrp-${s.id}`} name="mrp" label="MRP (₹)" optional inputMode="decimal" defaultValue={toMajorInput(s.mrpMinor)} hint="Clear the field to remove the MRP" />
                    </div>
                    {tracked ? (
                      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                        <TextField id={`qty-${s.id}`} name="quantity" label="Quantity in stock" type="number" min={0} inputMode="numeric" defaultValue={String(s.quantity)} />
                        <TextField id={`adj-${s.id}`} name="adjust" label="Or adjust by" type="number" inputMode="numeric" placeholder="e.g. -2 or 5" hint="Sold 2? Enter -2." />
                        <div className="flex gap-2 sm:pb-[1.625rem]">
                          <SubmitButton variant="outline" name="adjustQuick" value="-1">
                            <span aria-hidden>−1</span>
                            <span className="sr-only">Decrease quantity by 1</span>
                          </SubmitButton>
                          <SubmitButton variant="outline" name="adjustQuick" value="1">
                            <span aria-hidden>+1</span>
                            <span className="sr-only">Increase quantity by 1</span>
                          </SubmitButton>
                        </div>
                      </div>
                    ) : (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <SelectField id={`status-${s.id}`} name="stockStatus" label="Availability" defaultValue={st} options={STOCK_STATUS_OPTIONS} />
                        <TextField id={`qty-${s.id}`} name="quantity" label="Start tracking quantity" type="number" min={0} inputMode="numeric" optional hint="Enter a count to track exact stock" />
                      </div>
                    )}
                    <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
                      <TextField id={`thr-${s.id}`} name="lowStockThreshold" label="Low-stock alert at" type="number" min={0} inputMode="numeric" defaultValue={String(s.lowStockThreshold)} />
                      {tracked && <Checkbox name="untrackQuantity" label="Stop tracking an exact quantity" />}
                    </div>
                    <div className="flex justify-end">
                      <SubmitButton>Save changes</SubmitButton>
                    </div>
                  </MerchantForm>
                  <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted">Nothing changed? Confirm it so customers see this was checked recently.</p>
                    <MerchantForm key={`confirm-${s.id}-${s.version}`} action={confirmStockAction.bind(null, s.id, s.version)} className="gap-2">
                      <SubmitButton variant="soft">Confirm stock is still accurate</SubmitButton>
                    </MerchantForm>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted">Your role can view but not change stock.</p>
              )}
            </Card>
          );
        })}

        {canManage && missingBranches.length > 0 && (
          <Card className="p-4">
            <h3 className="mb-3 font-semibold">Add stock at another branch</h3>
            <MerchantForm action={addBranchStockAction.bind(null, listingId)} resetOnSuccess planHref={planHref}>
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField name="branchId" label="Branch" options={missingBranches.map((b) => ({ value: b.id, label: b.name }))} />
                <TextField name="price" label="Selling price (₹)" inputMode="decimal" required />
                <TextField name="quantity" label="Quantity" type="number" min={0} inputMode="numeric" optional hint="Leave empty to set availability instead" />
                <SelectField name="stockStatus" label="Availability (if not counting)" defaultValue="in_stock" options={STOCK_STATUS_OPTIONS} />
              </div>
              <div className="flex justify-end">
                <SubmitButton variant="outline">Add branch stock</SubmitButton>
              </div>
            </MerchantForm>
          </Card>
        )}
      </section>

      <section aria-labelledby="photos-h" className="flex flex-col gap-3">
        <h2 id="photos-h" className="text-heading font-semibold">
          Photos
        </h2>
        <Card className="flex flex-col gap-4 p-4">
          {images.length > 0 ? (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {images.map((img) => (
                <li key={img.id} className="flex flex-col gap-2">
                  <ProductImage src={img.url} alt={img.alt ?? title} className="aspect-square w-full rounded-lg border border-border" sizes="200px" />
                  {img.listingId === listingId ? (
                    canManage && (
                      <MerchantForm action={removeListingPhotoAction.bind(null, listingId, img.id)} className="gap-0">
                        <SubmitButton variant="ghost" size="sm">
                          <Trash2 className="size-4" aria-hidden /> Remove
                        </SubmitButton>
                      </MerchantForm>
                    )
                  ) : (
                    <span className="text-xs text-muted">Catalogue photo</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No photos yet. Products with a clear photo get more views.</p>
          )}
          {canUpload && (
            <ImageUpload
              label="Add a photo"
              shape="square"
              action={uploadListingPhotoAction.bind(null, shopId, listingId)}
              planHref={planHref}
              hint="Up to 8 photos of your actual item. JPEG, PNG or WebP."
            />
          )}
        </Card>
      </section>

      <section aria-labelledby="details-h" className="flex flex-col gap-3">
        <h2 id="details-h" className="text-heading font-semibold">
          Product details
        </h2>
        <Card className="p-4">
          {!editableCatalog && (
            <Alert tone="info" className="mb-4">
              <span className="inline-flex items-center gap-1 font-medium">
                <Lock className="size-4" aria-hidden /> Shared catalogue product.
              </span>{" "}
              Name, brand, variant and specifications are shared by every shop selling this item, so they can&apos;t be edited here. Spotted a mistake? Use “Report incorrect information” on the public product page and our team will correct it.
            </Alert>
          )}
          {canManage ? (
            <MerchantForm action={updateListingAction.bind(null, listingId, editableCatalog)}>
              {editableCatalog && (
                <ProductFields
                  groups={groups}
                  initial={{
                    name: product.p.name,
                    brand: product.brand,
                    model: product.p.model,
                    variant: product.p.variant,
                    categoryId: product.p.categoryId,
                    description: product.p.description,
                    specs: product.p.specs,
                    aliases: product.p.aliases,
                    gtin: product.p.gtin,
                  }}
                />
              )}
              {!editableCatalog && <ReadOnlyProduct specs={product.p.specs} description={product.p.description} />}
              <TextAreaField name="notes" label="Shop notes" optional defaultValue={listing.notes ?? ""} rows={3} maxLength={1000} hint="Warranty, bundle contents, installation — shown with your price." />
              <div className="flex justify-end">
                <SubmitButton>Save details</SubmitButton>
              </div>
            </MerchantForm>
          ) : (
            <>
              <ReadOnlyProduct specs={product.p.specs} description={product.p.description} />
              {listing.notes && <p className="mt-3 text-sm">Shop notes: {listing.notes}</p>}
            </>
          )}
        </Card>
      </section>

      <section aria-labelledby="history-h" className="flex flex-col gap-3">
        <h2 id="history-h" className="text-heading font-semibold">
          Change history
        </h2>
        {history.length === 0 ? (
          <Card>
            <EmptyState icon={<Info className="size-5" />} title="No changes recorded yet" />
          </Card>
        ) : (
          <>
            <ul className="flex flex-col gap-2 md:hidden">
              {history.map((h) => (
                <li key={h.id}>
                  <Card className="p-3 text-sm">
                    <p className="text-xs text-muted">
                      {formatDateTime(h.createdAt)} · {h.branchName}
                    </p>
                    <HistoryChanges h={h} />
                  </Card>
                </li>
              ))}
            </ul>
            <Card className="hidden overflow-hidden md:block">
              <table className="w-full text-sm">
                <caption className="sr-only">Price and stock changes, newest first</caption>
                <thead className="border-b border-border bg-surface-2 text-left text-xs text-muted">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 font-medium">When</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Branch</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Price</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Quantity</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {history.map((h) => (
                    <tr key={h.id}>
                      <td className="px-4 py-2.5 whitespace-nowrap text-muted">{formatDateTime(h.createdAt)}</td>
                      <td className="px-4 py-2.5">{h.branchName}</td>
                      <td className="px-4 py-2.5 tabular">{change(h.oldPriceMinor, h.newPriceMinor, (v) => formatMoney(v))}</td>
                      <td className="px-4 py-2.5 tabular">{change(h.oldQuantity, h.newQuantity, String, "not tracked")}</td>
                      <td className="px-4 py-2.5">{change(h.oldStockStatus, h.newStockStatus, (v) => STOCK_LABELS[v as StockStatus] ?? v)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </>
        )}
      </section>
    </div>
  );
}

function change<T>(oldV: T | null, newV: T | null, fmt: (v: T) => string, nullLabel = "—") {
  const f = (v: T | null) => (v == null ? nullLabel : fmt(v));
  if (oldV === newV) return <span className="text-muted">{f(newV)}</span>;
  if (oldV == null && newV != null && nullLabel === "—") return f(newV);
  return (
    <span>
      <span className="text-muted line-through">{f(oldV)}</span> → {f(newV)}
    </span>
  );
}

function HistoryChanges({ h }: { h: { oldPriceMinor: number | null; newPriceMinor: number | null; oldQuantity: number | null; newQuantity: number | null; oldStockStatus: string | null; newStockStatus: string | null } }) {
  const rows: string[] = [];
  if (h.oldPriceMinor !== h.newPriceMinor && h.newPriceMinor != null) rows.push(`Price ${h.oldPriceMinor != null ? `${formatMoney(h.oldPriceMinor)} → ` : ""}${formatMoney(h.newPriceMinor)}`);
  if (h.oldQuantity !== h.newQuantity) rows.push(`Quantity ${h.oldQuantity ?? "not tracked"} → ${h.newQuantity ?? "not tracked"}`);
  if (h.oldStockStatus !== h.newStockStatus && h.newStockStatus) rows.push(`Status ${h.oldStockStatus ? `${STOCK_LABELS[h.oldStockStatus as StockStatus]} → ` : ""}${STOCK_LABELS[h.newStockStatus as StockStatus]}`);
  if (!rows.length) rows.push("Confirmed as still accurate");
  return (
    <ul className="mt-1 flex flex-col gap-0.5">
      {rows.map((r) => (
        <li key={r}>{r}</li>
      ))}
    </ul>
  );
}

function ReadOnlyProduct({ specs, description }: { specs: Record<string, string>; description: string | null }) {
  const entries = Object.entries(specs);
  return (
    <div className="flex flex-col gap-3 text-sm">
      {description && <p className="whitespace-pre-line text-muted">{description}</p>}
      {entries.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          {entries.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {!description && entries.length === 0 && <p className="text-muted">No description or specifications in the catalogue yet.</p>}
    </div>
  );
}
