"use client";

import type { ReactNode } from "react";
import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ActionForm, SubmitButton, type FormAction } from "./action-form";
import { TextAreaField } from "./fields";

type Props = {
  action: FormAction;
  label: ReactNode;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  /** Require a reason (sent as `reason`). */
  reason?: { label: string; placeholder?: string };
  hidden?: Record<string, string>;
  variant?: ButtonVariant;
  confirmVariant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  successMessage?: string;
  redirectTo?: string;
};

/** A button that opens a confirmation dialog before running a (usually destructive) server action. */
export function ConfirmAction({
  action,
  label,
  title,
  description,
  confirmLabel = "Confirm",
  reason,
  hidden,
  variant = "outline",
  confirmVariant = "danger",
  size = "sm",
  icon,
  successMessage,
  redirectTo,
}: Props) {
  return (
    <Dialog
      title={title}
      description={description}
      trigger={(open) => (
        <Button variant={variant} size={size} onClick={open} icon={icon}>
          {label}
        </Button>
      )}
    >
      {(close) => (
        <ActionForm action={action} successMessage={successMessage} redirectTo={redirectTo} onSuccess={close}>
          {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          {reason && <TextAreaField name="reason" label={reason.label} placeholder={reason.placeholder} rows={3} required />}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <SubmitButton variant={confirmVariant}>{confirmLabel}</SubmitButton>
          </div>
        </ActionForm>
      )}
    </Dialog>
  );
}
