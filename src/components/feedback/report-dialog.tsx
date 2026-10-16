"use client";

import { Flag } from "lucide-react";
import { reportAction } from "@/app/(public)/actions";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { SelectField, TextAreaField } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

const REASONS = [
  ["incorrect_info", "Incorrect product or price information"],
  ["out_of_stock", "Marked available but out of stock"],
  ["closed", "Shop closed or does not exist"],
  ["prohibited", "Prohibited or unsafe item"],
  ["offensive", "Offensive or inappropriate content"],
  ["spam", "Spam or misleading"],
  ["duplicate", "Duplicate listing"],
  ["other", "Something else"],
] as const;

export function ReportDialog({ targetType, targetId, label = "Report incorrect information", signedIn }: { targetType: "shop" | "listing" | "product" | "review" | "offer"; targetId: string; label?: string; signedIn: boolean }) {
  if (!signedIn) {
    return (
      <a href={`/login?next=${encodeURIComponent("/")}`} className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted hover:text-fg">
        <Flag className="size-4" aria-hidden /> {label}
      </a>
    );
  }
  return (
    <Dialog
      title="Report a problem"
      description="Reports go to Locafy moderators. The shop isn't told who reported."
      trigger={(open) => (
        <Button variant="ghost" size="sm" onClick={open} icon={<Flag className="size-4" aria-hidden />} className="text-muted">
          {label}
        </Button>
      )}
    >
      {(close) => (
        <ActionForm action={reportAction} onSuccess={close}>
          <input type="hidden" name="targetType" value={targetType} />
          <input type="hidden" name="targetId" value={targetId} />
          <SelectField name="reason" label="What's wrong?" options={REASONS.map(([value, label]) => ({ value, label }))} required />
          <TextAreaField name="details" label="Details" optional rows={3} placeholder="Anything that helps us check, e.g. the correct price." />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <SubmitButton>Send report</SubmitButton>
          </div>
        </ActionForm>
      )}
    </Dialog>
  );
}
