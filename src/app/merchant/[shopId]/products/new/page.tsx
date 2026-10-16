import type { Metadata } from "next";
import { SubmitButton } from "@/components/forms/action-form";
import { MerchantForm } from "@/components/merchant/merchant-form";
import { TextAreaField } from "@/components/forms/fields";
import { CatalogPicker } from "@/components/merchant/catalog-picker";
import { BackLink, NoAccess } from "@/components/merchant/misc";
import { StockFields } from "@/components/merchant/stock-fields";
import { LinkButton } from "@/components/ui/button";
import { FormSection } from "@/components/ui/form";
import { Alert, Card, PageHeader } from "@/components/ui/primitives";
import { roleAllows } from "@/modules/access/permissions";
import { loadShop, productCategoryGroups, requireMerchant } from "../../../_lib/data";
import { createListingAction } from "../actions";

export const metadata: Metadata = { title: "Add product" };

export default async function NewProductPage({ params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params;
  await requireMerchant(`/merchant/${shopId}/products/new`);
  const { shop, role, branches } = await loadShop(shopId);
  const base = `/merchant/${shopId}`;
  const back = <BackLink href={`${base}/products`}>Products</BackLink>;
  if (!roleAllows(role, "listing.manage")) {
    return (
      <>
        <PageHeader back={back} title="Add product" />
        <NoAccess what="adding products" />
      </>
    );
  }
  if (shop.status === "suspended") {
    return (
      <>
        <PageHeader back={back} title="Add product" />
        <Alert tone="danger" title="This shop is suspended">Product changes are disabled while the shop is suspended.</Alert>
      </>
    );
  }
  const activeBranches = branches.filter((b) => b.isActive).map((b) => ({ id: b.id, name: b.name, hasLocation: b.lat != null }));
  if (activeBranches.length === 0) {
    return (
      <>
        <PageHeader back={back} title="Add product" />
        <Alert tone="warning" title="Add your shop address first" action={<LinkButton href={`${base}/onboarding?step=2`} size="sm">Add address</LinkButton>}>
          Prices and stock are kept per store location, so your shop needs an address before you can add products.
        </Alert>
      </>
    );
  }
  const groups = await productCategoryGroups();
  const canPublish = shop.status === "active";

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader back={back} title="Add product" description="Pick the product, then set your price and stock." />
      <Card className="p-4 sm:p-6">
        <MerchantForm action={createListingAction.bind(null, shopId)} planHref={`${base}/plan`}>
          <FormSection title="Product" description="Search the shared Locafy catalogue first. If it isn't there, add it.">
            <CatalogPicker groups={groups} />
          </FormSection>
          <FormSection title="Price & stock" description="What customers see for this product at your shop.">
            <StockFields branches={activeBranches} />
          </FormSection>
          <FormSection title="Shop notes" description="Only about your offer — warranty, bundle contents, installation.">
            <TextAreaField name="notes" label="Notes" optional rows={3} maxLength={1000} placeholder="e.g. 1-year brand warranty, free screen guard" />
          </FormSection>
          {!canPublish && (
            <Alert tone="info">Your shop isn&apos;t approved yet, so products are saved as drafts. Publish them once your shop is live.</Alert>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <SubmitButton variant={canPublish ? "outline" : "primary"} name="publish" value="0" pendingLabel="Saving…">
              Save draft
            </SubmitButton>
            {canPublish && (
              <SubmitButton name="publish" value="1" pendingLabel="Publishing…">
                Save &amp; publish
              </SubmitButton>
            )}
          </div>
        </MerchantForm>
      </Card>
    </div>
  );
}
