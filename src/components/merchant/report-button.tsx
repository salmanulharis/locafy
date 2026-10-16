"use client";

import { Flag } from "lucide-react";
import { SubmitButton, type FormAction } from "@/components/forms/action-form";
import { MerchantForm } from "./merchant-form";
import { SelectField, TextAreaField } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

const REASONS = [
  { value: "spam", label: "Spam or misleading" },
  { value: "offensive", label: "Abusive or inappropriate" },
  { value: "other", label: "Something else" },
];

/** Report an abusive enquiry to Locafy moderators. */
export function ReportButton({ action, what = "enquiry" }: { action: FormAction; what?: string }) {
  return (
    <Dialog
      title={`Report this ${what}`}
      description="Our moderators review reports. The customer isn't told who reported them."
      trigger={(open) => (
        <Button variant="ghost" onClick={open} icon={<Flag className="size-4" aria-hidden />}>
          Report abuse
        </Button>
      )}
    >
      {(close) => (
        <MerchantForm action={action} onSuccess={close}>
          <SelectField name="reason" label="Reason" options={REASONS} defaultValue="spam" />
          <TextAreaField name="details" label="Details" optional rows={3} maxLength={1000} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <SubmitButton variant="danger">Send report</SubmitButton>
          </div>
        </MerchantForm>
      )}
    </Dialog>
  );
}
