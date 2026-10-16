import type { Metadata } from "next";
import { SubmitButton } from "@/components/forms/action-form";
import { MerchantForm } from "@/components/merchant/merchant-form";
import { SelectField, TextAreaField, TextField } from "@/components/forms/fields";
import { BackLink } from "@/components/merchant/misc";
import { Card, PageHeader } from "@/components/ui/primitives";
import { listCategories } from "@/modules/catalog/service";
import { requireMerchant } from "../_lib/data";
import { createShopAction } from "../actions";

export const metadata: Metadata = { title: "Create your shop" };

export default async function NewShopPage() {
  await requireMerchant("/merchant/new");
  const categories = (await listCategories({ scope: "shop" })).filter((c) => !c.parentId);
  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:py-10">
      <PageHeader
        back={<BackLink href="/merchant">My shops</BackLink>}
        title="Create your shop"
        description="Step 1 of 5 · You can change these details later. Nothing is public until Locafy approves your shop."
      />
      <Card className="p-4 sm:p-6">
        <MerchantForm action={createShopAction}>
          <TextField name="name" label="Shop name" autoComplete="organization" required maxLength={80} hint="As shown on your signboard, e.g. “Demo Mobiles Edappally”." />
          <SelectField
            name="categoryId"
            label="Main category"
            placeholder="Choose what you mainly sell"
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
            required
          />
          <TextAreaField name="description" label="Short description" optional maxLength={1000} rows={4} hint="What you sell, brands you stock, services like repairs or delivery." />
          <div className="flex justify-end">
            <SubmitButton pendingLabel="Creating…">Create shop and continue</SubmitButton>
          </div>
        </MerchantForm>
      </Card>
    </div>
  );
}
