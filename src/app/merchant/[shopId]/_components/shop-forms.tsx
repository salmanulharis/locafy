import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import { SubmitButton } from "@/components/forms/action-form";
import { MerchantForm } from "@/components/merchant/merchant-form";
import { FieldError, SelectField, TextAreaField, TextField } from "@/components/forms/fields";
import { HoursEditor } from "@/components/merchant/hours-editor";
import { ImageUpload } from "@/components/merchant/image-upload";
import { PinPicker } from "@/components/maps/pin-picker";
import { LinkButton } from "@/components/ui/button";
import { Alert } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import type { getMerchantShop } from "@/modules/shops/service";
import {
  removeShopImageAction,
  saveAddressAction,
  saveBasicsAction,
  saveContactAction,
  submitVerificationAction,
  uploadShopImageAction,
} from "../actions";

export type MerchantShopData = Awaited<ReturnType<typeof getMerchantShop>>;
type Shop = MerchantShopData["shop"];
type Branch = MerchantShopData["branches"][number];

export const STEPS = [
  { n: 1, key: "details", label: "Details" },
  { n: 2, key: "address", label: "Address & map" },
  { n: 3, key: "contact", label: "Contact & hours" },
  { n: 4, key: "photos", label: "Logo & photos" },
  { n: 5, key: "verification", label: "Verify & submit" },
] as const;

export type StepKey = (typeof STEPS)[number]["key"];

export function stepDone(data: MerchantShopData): Record<StepKey, boolean> {
  const primary = data.branches.find((b) => b.isPrimary);
  return {
    details: Boolean(data.shop.categoryId && data.shop.name),
    address: primary?.lat != null,
    contact: Boolean(data.shop.phone),
    photos: Boolean(data.shop.logoUrl),
    verification: ["pending", "active"].includes(data.shop.status),
  };
}

export function StepProgress({ shopId, current, done }: { shopId: string; current: number; done: Record<StepKey, boolean> }) {
  return (
    <nav aria-label="Setup steps" className="mb-6">
      <p className="mb-2 text-sm text-muted">
        Step {current} of {STEPS.length}
      </p>
      <ol className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-5 sm:px-0">
        {STEPS.map((s) => {
          const isCurrent = s.n === current;
          const isDone = done[s.key];
          return (
            <li key={s.key} className="shrink-0">
              <Link
                href={`/merchant/${shopId}/onboarding?step=${s.n}`}
                aria-current={isCurrent ? "step" : undefined}
                className={cn(
                  "relative flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                  isCurrent ? "border-primary bg-primary-soft font-medium text-primary-soft-fg" : "border-border bg-surface text-muted hover:text-fg",
                )}
              >
                {isDone ? <CheckCircle2 className="size-4 shrink-0 text-success-soft-fg" aria-hidden /> : <Circle className="size-4 shrink-0" aria-hidden />}
                <span className="whitespace-nowrap">{s.label}</span>
                <span className="sr-only">{isDone ? "(done)" : "(to do)"}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Explains the shop's lifecycle status in plain language. */
export function ShopStatusBanner({ shop, shopId, gaps, compact }: { shop: Shop; shopId: string; gaps?: string[]; compact?: boolean }) {
  switch (shop.status) {
    case "draft":
      return (
        <Alert
          tone="info"
          title="Your shop isn't live yet"
          action={compact ? <LinkButton href={`/merchant/${shopId}/onboarding`} size="sm">Continue setup</LinkButton> : undefined}
        >
          Finish the setup steps and submit your shop for review. Customers can&apos;t see it until Locafy approves it.
          {gaps && gaps.length > 0 && <> Still missing: {gaps.join(", ")}.</>}
        </Alert>
      );
    case "pending":
      return (
        <Alert tone="info" title="Under review">
          Locafy is checking your shop details. You&apos;ll get a notification when it&apos;s approved. You can keep adding products as drafts and editing your details meanwhile.
        </Alert>
      );
    case "rejected":
      return (
        <Alert
          tone="danger"
          title="Changes needed before approval"
          action={compact ? <LinkButton href={`/merchant/${shopId}/onboarding?step=5`} size="sm" variant="outline">Fix and resubmit</LinkButton> : undefined}
        >
          {shop.statusReason ? <>Reviewer&apos;s note: “{shop.statusReason}”. </> : null}
          Update your details, then resubmit from the last step.
        </Alert>
      );
    case "suspended":
      return (
        <Alert tone="danger" title="This shop is suspended">
          {shop.statusReason ? <>Reason: “{shop.statusReason}”. </> : null}
          Your shop and products are hidden from customers and editing is disabled. Contact Locafy support to restore access.
        </Alert>
      );
    default:
      return null;
  }
}

export function DetailsForm({ shop, categories, next }: { shop: Shop; categories: { id: string; name: string }[]; next?: string }) {
  return (
    <MerchantForm action={saveBasicsAction.bind(null, shop.id)} redirectTo={next}>
      <TextField name="name" label="Shop name" defaultValue={shop.name} required maxLength={80} />
      <SelectField
        name="categoryId"
        label="Main category"
        placeholder="Choose a category"
        defaultValue={shop.categoryId ?? ""}
        options={categories.map((c) => ({ value: c.id, label: c.name }))}
        required
      />
      <TextAreaField name="description" label="Short description" optional defaultValue={shop.description ?? ""} maxLength={1000} rows={4} hint="Shown on your shop page." />
      <div className="flex justify-end">
        <SubmitButton>{next ? "Save and continue" : "Save details"}</SubmitButton>
      </div>
    </MerchantForm>
  );
}

export function AddressForm({ shop, branch, next }: { shop: Shop; branch: Branch | undefined; next?: string }) {
  const initial = branch?.lat != null && branch?.lng != null ? { lat: branch.lat, lng: branch.lng } : null;
  return (
    <MerchantForm action={saveAddressAction.bind(null, shop.id)} redirectTo={next}>
      <TextField name="addressLine" label="Street address" defaultValue={branch?.addressLine ?? ""} autoComplete="street-address" required hint="Building, street and landmark customers will recognise." />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="locality" label="Area / locality" optional defaultValue={branch?.locality ?? ""} />
        <TextField name="city" label="Town or city" defaultValue={branch?.city ?? ""} autoComplete="address-level2" required />
        <TextField name="region" label="State" optional defaultValue={branch?.region ?? ""} autoComplete="address-level1" />
        <TextField name="postalCode" label="PIN code" optional defaultValue={branch?.postalCode ?? ""} autoComplete="postal-code" inputMode="numeric" />
      </div>
      <TextField name="phone" label="Store phone" optional type="tel" defaultValue={branch?.phone ?? ""} hint="If different from the main shop phone." />
      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-medium">Location on the map</p>
        <p className="text-sm text-muted">Tap the map or drag the pin to your shop entrance. Customers use this for distance and directions.</p>
        <PinPicker initial={initial} />
        <FieldError name="lat" />
        <FieldError name="lng" />
      </div>
      <div className="flex justify-end">
        <SubmitButton>{next ? "Save and continue" : "Save address"}</SubmitButton>
      </div>
    </MerchantForm>
  );
}

export function ContactForm({ shop, branch, next }: { shop: Shop; branch: Branch | undefined; next?: string }) {
  return (
    <MerchantForm action={saveContactAction.bind(null, shop.id)} redirectTo={next}>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="phone" label="Phone" type="tel" autoComplete="tel" defaultValue={shop.phone ?? ""} required />
        <TextField name="whatsapp" label="WhatsApp number" type="tel" optional defaultValue={shop.whatsapp ?? ""} />
        <TextField name="email" label="Email" type="email" optional defaultValue={shop.email ?? ""} />
        <TextField name="website" label="Website" type="url" optional placeholder="https://" defaultValue={shop.website ?? ""} />
      </div>
      {branch ? (
        <HoursEditor initial={branch.openingHours ?? null} />
      ) : (
        <Alert tone="info">Add your address first — opening hours are saved with your main store.</Alert>
      )}
      <div className="flex justify-end">
        <SubmitButton>{next ? "Save and continue" : "Save contact details"}</SubmitButton>
      </div>
    </MerchantForm>
  );
}

export function PhotosForm({ shop, next, prev, readOnly }: { shop: Shop; next?: string; prev?: string; readOnly?: boolean }) {
  const planHref = `/merchant/${shop.id}/plan`;
  return (
    <div className="flex flex-col gap-8">
      <ImageUpload
        label="Logo"
        hint="Square image, at least 256 × 256 px. JPEG, PNG or WebP."
        action={uploadShopImageAction.bind(null, shop.id, "logo")}
        removeAction={removeShopImageAction.bind(null, shop.id, "logo")}
        currentUrl={shop.logoUrl}
        planHref={planHref}
        disabled={readOnly}
      />
      <ImageUpload
        label="Cover photo"
        shape="wide"
        hint="A wide photo of your storefront or interior. JPEG, PNG or WebP."
        action={uploadShopImageAction.bind(null, shop.id, "cover")}
        removeAction={removeShopImageAction.bind(null, shop.id, "cover")}
        currentUrl={shop.coverUrl}
        planHref={planHref}
        disabled={readOnly}
      />
      {(next || prev) && (
        <div className="flex justify-between gap-2">
          {prev ? <LinkButton href={prev} variant="ghost">Back</LinkButton> : <span />}
          {next && <LinkButton href={next}>{shop.logoUrl ? "Continue" : "Skip for now"}</LinkButton>}
        </div>
      )}
    </div>
  );
}

export function VerificationForm({ shop, gaps, canSubmit }: { shop: Shop; gaps: string[]; canSubmit: boolean }) {
  if (shop.status === "pending") {
    return (
      <Alert tone="info" title="Submitted — under review">
        We received your details{shop.submittedAt ? ` on ${new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(shop.submittedAt)}` : ""}. You&apos;ll be notified once a reviewer has checked them.
      </Alert>
    );
  }
  if (shop.status === "active") {
    return (
      <Alert tone="success" title="Your shop is approved and live">
        Customers can find your shop and published products.
      </Alert>
    );
  }
  if (shop.status === "suspended") return null;
  if (!canSubmit) return <Alert tone="info">Only the shop owner can submit the shop for review.</Alert>;
  return (
    <div className="flex flex-col gap-4">
      {gaps.length > 0 ? (
        <Alert tone="warning" title="Complete these before submitting">
          <ul className="mt-1 list-disc pl-5">
            {gaps.map((g) => (
              <li key={g} className="first-letter:uppercase">
                {g}
              </li>
            ))}
          </ul>
        </Alert>
      ) : (
        <Alert tone="success">All required details are complete.</Alert>
      )}
      <MerchantForm action={submitVerificationAction.bind(null, shop.id)}>
        <TextAreaField
          name="verificationNote"
          label="Business verification details"
          defaultValue={shop.verificationNote ?? ""}
          rows={4}
          required
          maxLength={1000}
          hint="GSTIN, trade licence or shop registration number, or a short note about your business. Only Locafy reviewers see this."
        />
        <div className="flex justify-end">
          <SubmitButton pendingLabel="Submitting…">{shop.status === "rejected" ? "Resubmit for review" : "Submit for review"}</SubmitButton>
        </div>
      </MerchantForm>
    </div>
  );
}
