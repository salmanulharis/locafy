import type { Metadata } from "next";
import { LinkButton } from "@/components/ui/button";
import { Alert, Card, PageHeader } from "@/components/ui/primitives";
import { NoAccess } from "@/components/merchant/misc";
import { roleAllows } from "@/modules/access/permissions";
import { listCategories } from "@/modules/catalog/service";
import { onboardingGaps } from "@/modules/shops/service";
import { loadShop, requireMerchant, sp, type SearchParams } from "../../_lib/data";
import {
  AddressForm,
  ContactForm,
  DetailsForm,
  PhotosForm,
  ShopStatusBanner,
  StepProgress,
  STEPS,
  stepDone,
  VerificationForm,
} from "../_components/shop-forms";

export const metadata: Metadata = { title: "Set up your shop" };

const INTRO: Record<number, string> = {
  1: "The basics customers see first.",
  2: "Where customers find you. The map pin is used for distance and directions.",
  3: "How customers reach you and when you're open.",
  4: "A logo and storefront photo help customers recognise your shop. Optional, but recommended.",
  5: "Tell us how to verify your business, then submit for review.",
};

export default async function OnboardingPage({ params, searchParams }: { params: Promise<{ shopId: string }>; searchParams: SearchParams }) {
  const { shopId } = await params;
  const q = await searchParams;
  await requireMerchant(`/merchant/${shopId}/onboarding`);
  const data = await loadShop(shopId);
  const { shop, role, branches } = data;
  if (!roleAllows(role, "shop.edit")) return <NoAccess what="editing the shop profile" />;

  const done = stepDone(data);
  const requested = Number(sp(q.step));
  const firstOpen = !done.details ? 1 : !done.address ? 2 : !done.contact ? 3 : 5;
  const step = requested >= 1 && requested <= 5 ? requested : firstOpen;
  const [categories, gaps] = await Promise.all([
    step === 1 ? listCategories({ scope: "shop" }).then((c) => c.filter((x) => !x.parentId)) : Promise.resolve([]),
    onboardingGaps(shopId),
  ]);
  const primary = branches.find((b) => b.isPrimary);
  const readOnly = shop.status === "suspended";
  const href = (n: number) => `/merchant/${shopId}/onboarding?step=${n}`;
  const next = step < 5 ? href(step + 1) : undefined;
  const prev = step > 1 ? href(step - 1) : undefined;
  const title = STEPS[step - 1]!.label;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Set up your shop" description={`${title} · ${INTRO[step]}`} />
      {sp(q.created) && <Alert tone="success" className="mb-4">Shop created. A few more details and you can submit it for review.</Alert>}
      <div className="mb-4">
        <ShopStatusBanner shop={shop} shopId={shopId} />
      </div>
      <StepProgress shopId={shopId} current={step} done={done} />
      <Card className="p-4 sm:p-6">
        <h2 className="mb-4 text-heading font-semibold">
          {step}. {title}
        </h2>
        <fieldset disabled={readOnly} className="m-0 min-w-0 border-0 p-0">
          {step === 1 && <DetailsForm shop={shop} categories={categories} next={next} />}
          {step === 2 && <AddressForm shop={shop} branch={primary} next={next} />}
          {step === 3 && <ContactForm shop={shop} branch={primary} next={next} />}
          {step === 4 && <PhotosForm shop={shop} next={next} prev={prev} readOnly={readOnly} />}
          {step === 5 && <VerificationForm shop={shop} gaps={gaps} canSubmit={roleAllows(role, "shop.submit")} />}
        </fieldset>
      </Card>
      {step !== 4 && (
        <div className="mt-4 flex justify-between gap-2">
          {prev ? (
            <LinkButton href={prev} variant="ghost">
              Back
            </LinkButton>
          ) : (
            <span />
          )}
          {step === 5 ? (
            <LinkButton href={`/merchant/${shopId}`} variant="outline">
              Go to dashboard
            </LinkButton>
          ) : (
            next && (
              <LinkButton href={next} variant="ghost">
                Skip this step
              </LinkButton>
            )
          )}
        </div>
      )}
    </div>
  );
}
