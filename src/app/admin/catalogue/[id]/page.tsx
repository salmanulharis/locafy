import Link from "next/link";
import { Ban, ExternalLink, RotateCcw } from "lucide-react";
import { categoryOptions } from "@/components/admin/category-tree";
import { DataTable } from "@/components/admin/data-table";
import { formatDateTime } from "@/components/admin/format";
import { MergeProductDialog } from "@/components/admin/merge-dialog";
import { BackLink, Panel } from "@/components/admin/panel";
import { SpecsEditor } from "@/components/admin/specs-editor";
import { StatusBadge } from "@/components/admin/status-badge";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { ConfirmAction } from "@/components/forms/confirm-action";
import { SelectField, TextAreaField, TextField } from "@/components/forms/fields";
import { Alert, PageHeader } from "@/components/ui/primitives";
import { getCatalogProductForAdmin } from "@/modules/administration/service";
import { listCategories } from "@/modules/catalog/service";
import { mergeCatalogAction, setCatalogRestrictedAction, setListingRestrictedAction, updateCatalogAction } from "../../actions";
import { adminCtx, orNotFound } from "../../_lib/guard";

export const metadata = { title: "Catalogue product" };

export default async function AdminCatalogProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await adminCtx(`/admin/catalogue/${id}`);
  const [data, categories] = await Promise.all([orNotFound(getCatalogProductForAdmin(ctx, id)), listCategories({ includeInactive: true })]);
  const { product: p, brand, listings, similar } = data;
  const merged = p.status === "merged";
  const productCategories = categories.filter((c) => c.scope !== "shop" || c.id === p.categoryId);

  return (
    <>
      <BackLink href="/admin/catalogue">Catalogue</BackLink>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {p.name}
            <StatusBadge status={p.status} />
          </span>
        }
        description={[brand, p.model, p.variant].filter(Boolean).join(" · ") || undefined}
        actions={
          p.status === "active" ? (
            <Link href={`/p/${p.slug}`} className="inline-flex min-h-11 items-center gap-1.5 text-sm text-primary hover:underline">
              Public page <ExternalLink className="size-4" aria-hidden />
            </Link>
          ) : undefined
        }
      />

      {merged && (
        <Alert tone="info" title="Merged product" className="mb-4">
          This entry now redirects to{" "}
          {p.mergedIntoId ? (
            <Link href={`/admin/catalogue/${p.mergedIntoId}`} className="font-medium underline">
              the canonical product
            </Link>
          ) : (
            "another product"
          )}
          . It can no longer be edited, restricted or merged.
        </Alert>
      )}
      {p.status === "restricted" && (
        <Alert tone="warning" title="Restricted" className="mb-4">
          Shops cannot list this product and it is hidden from customers.
        </Alert>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <Panel title="Product details" description="Changes apply to every shop that lists this product.">
            {merged ? (
              <p className="text-sm text-muted">Editing is disabled for merged products.</p>
            ) : (
              <ActionForm action={updateCatalogAction.bind(null, p.id)}>
                <TextField name="name" label="Name" defaultValue={p.name} required maxLength={140} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField name="brand" label="Brand" optional defaultValue={brand ?? ""} maxLength={60} />
                  <TextField name="model" label="Model" optional defaultValue={p.model ?? ""} maxLength={80} />
                  <TextField name="variant" label="Variant" optional defaultValue={p.variant ?? ""} maxLength={80} hint="e.g. 8GB / 128GB, Black" />
                  <TextField name="gtin" label="Barcode (GTIN)" optional defaultValue={p.gtin ?? ""} inputMode="numeric" hint="8–14 digits" />
                </div>
                <SelectField name="categoryId" label="Category" defaultValue={p.categoryId ?? ""} placeholder="Choose a category" options={categoryOptions(productCategories)} />
                <TextAreaField name="description" label="Description" optional defaultValue={p.description ?? ""} rows={4} maxLength={4000} />
                <TextField name="aliases" label="Aliases" optional defaultValue={p.aliases.join(", ")} hint="Comma-separated alternative names customers search for (max 15)." />
                <SpecsEditor initial={p.specs} />
                <div>
                  <SubmitButton>Save product</SubmitButton>
                </div>
              </ActionForm>
            )}
          </Panel>

          <Panel title={`Listings across shops (${listings.length})`} description="Restricting a listing hides it and notifies the shop owner.">
            {listings.length === 0 ? (
              <p className="text-sm text-muted">No shop lists this product.</p>
            ) : (
              <DataTable
                caption="Listings"
                rows={listings}
                rowKey={(r) => r.listingId}
                columns={[
                  {
                    header: "Shop",
                    mobileTitle: true,
                    cell: (r) => (
                      <Link href={`/admin/shops/${r.shopId}`} className="font-medium text-primary hover:underline">
                        {r.shopName}
                      </Link>
                    ),
                  },
                  { header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
                  { header: "Listing ID", cell: (r) => <span className="font-mono text-xs break-all select-all">{r.listingId}</span> },
                  {
                    header: "Moderation",
                    className: "text-right",
                    cell: (r) =>
                      r.status === "restricted" ? (
                        <ConfirmAction
                          action={setListingRestrictedAction.bind(null, r.listingId, false)}
                          label="Unrestrict"
                          title="Lift listing restriction?"
                          description="The listing returns as unpublished; the shop can publish it again."
                          confirmLabel="Lift restriction"
                          confirmVariant="primary"
                          size="md"
                          icon={<RotateCcw className="size-4" aria-hidden />}
                        />
                      ) : (
                        <ConfirmAction
                          action={setListingRestrictedAction.bind(null, r.listingId, true)}
                          label="Restrict"
                          title={`Restrict listing at ${r.shopName}?`}
                          confirmLabel="Restrict listing"
                          reason={{ label: "Reason shown to the shop" }}
                          size="md"
                          icon={<Ban className="size-4" aria-hidden />}
                        />
                      ),
                  },
                ]}
              />
            )}
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          {!merged && (
            <Panel title="Moderation">
              <div className="flex flex-wrap gap-2">
                {p.status === "restricted" ? (
                  <ConfirmAction
                    action={setCatalogRestrictedAction.bind(null, p.id, false)}
                    label="Unrestrict"
                    title="Lift product restriction?"
                    description="Shops can list it again. Existing listings are not republished automatically."
                    confirmLabel="Lift restriction"
                    confirmVariant="primary"
                    size="md"
                    icon={<RotateCcw className="size-4" aria-hidden />}
                  />
                ) : (
                  <ConfirmAction
                    action={setCatalogRestrictedAction.bind(null, p.id, true)}
                    label="Restrict"
                    title={`Restrict ${p.name}?`}
                    description="Shops will not be able to list this product."
                    confirmLabel="Restrict product"
                    reason={{ label: "Reason", placeholder: "e.g. Prohibited item." }}
                    size="md"
                    icon={<Ban className="size-4" aria-hidden />}
                  />
                )}
                <MergeProductDialog action={mergeCatalogAction.bind(null, p.id)} productName={p.name} candidates={similar} />
              </div>
              <p className="mt-3 text-xs text-muted">
                Merging moves listings to the target; if a shop already lists the target, its duplicate listing is archived. Prices are never combined.
              </p>
            </Panel>
          )}

          <Panel title="Similar products">
            {similar.length === 0 ? (
              <p className="text-sm text-muted">No similar active products found.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {similar.map((s) => (
                  <li key={s.id} className="text-sm">
                    <Link href={`/admin/catalogue/${s.id}`} className="flex min-h-11 flex-col justify-center text-primary hover:underline">
                      <span>{s.name}</span>
                      {s.variant && <span className="text-xs text-muted">{s.variant}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <p className="px-1 text-xs text-muted">
            ID <span className="font-mono break-all">{p.id}</span>
            <br />
            Created {formatDateTime(p.createdAt)} · updated {formatDateTime(p.updatedAt)}
          </p>
        </div>
      </div>
    </>
  );
}
