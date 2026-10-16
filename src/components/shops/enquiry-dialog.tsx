"use client";

import { useState } from "react";
import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { createEnquiryAction } from "@/app/(public)/actions";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { TextAreaField, TextField } from "@/components/forms/fields";
import { Button, LinkButton } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { ActionState } from "@/lib/actions";

/** Structured product-availability enquiry. Messages persist and the shop replies in-app. */
export function EnquiryDialog({ shopId, shopName, listingId, productName, signedIn, nextPath, size = "md" }: { shopId: string; shopName: string; listingId?: string; productName?: string; signedIn: boolean; nextPath: string; size?: "sm" | "md" }) {
  // A stable idempotency key per dialog session prevents duplicate enquiries on double submit.
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [sent, setSent] = useState<string | null>(null);

  if (!signedIn) {
    return (
      <LinkButton href={`/login?next=${encodeURIComponent(nextPath)}`} variant="outline" size={size} icon={<MessageSquare className="size-4" aria-hidden />}>
        Ask the shop
      </LinkButton>
    );
  }
  return (
    <Dialog
      title={`Ask ${shopName}`}
      description={productName ? `About: ${productName}` : "Send a question to the shop."}
      trigger={(open) => (
        <Button
          variant="outline"
          size={size}
          onClick={() => {
            setSent(null);
            setRequestId(crypto.randomUUID());
            open();
          }}
          icon={<MessageSquare className="size-4" aria-hidden />}
        >
          Ask the shop
        </Button>
      )}
    >
      {(close) =>
        sent ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm">Your enquiry was sent. You&apos;ll get a notification when {shopName} replies.</p>
            <div className="flex gap-2">
              <LinkButton href={`/account/enquiries/${sent}`} size="sm">
                View conversation
              </LinkButton>
              <Button variant="ghost" size="sm" onClick={close}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          <ActionForm action={createEnquiryAction} onSuccess={(s: ActionState) => setSent((s.data as { id: string })?.id ?? null)}>
            <input type="hidden" name="shopId" value={shopId} />
            {listingId && <input type="hidden" name="listingId" value={listingId} />}
            <input type="hidden" name="clientRequestId" value={requestId} />
            <div className="hidden" aria-hidden>
              <label htmlFor="website">Leave empty</label>
              <input id="website" name="website" tabIndex={-1} autoComplete="off" />
            </div>
            {listingId && <TextField name="quantity" label="Quantity" type="number" inputMode="numeric" min={1} max={10000} defaultValue={1} className="max-w-32" />}
            <TextAreaField
              name="message"
              label="Message"
              rows={4}
              required
              defaultValue={productName ? `Is ${productName} available? ` : ""}
              hint="Don't share payment details. Shops reply in Locafy."
            />
            <div className="flex items-center justify-between gap-2">
              <Link href="/account/enquiries" className="text-sm text-muted hover:text-fg">
                My enquiries
              </Link>
              <SubmitButton>Send enquiry</SubmitButton>
            </div>
          </ActionForm>
        )
      }
    </Dialog>
  );
}
