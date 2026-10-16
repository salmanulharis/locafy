"use client";

import { useState } from "react";
import { UserX } from "lucide-react";
import { ActionForm, SubmitButton, type FormAction } from "@/components/forms/action-form";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Alert } from "@/components/ui/primitives";
import { Input, Label } from "@/components/ui/form";

export const DELETE_CONFIRM_WORD = "DELETE";

/** Strong confirmation: the admin must type DELETE before the account is anonymised. */
export function DeleteAccountDialog({ action, email }: { action: FormAction; email: string }) {
  const [typed, setTyped] = useState("");
  return (
    <Dialog
      title="Process account deletion"
      description={email}
      trigger={(open) => (
        <Button variant="danger" size="md" onClick={open} icon={<UserX className="size-4" aria-hidden />}>
          Process deletion…
        </Button>
      )}
    >
      {(close) => (
        <ActionForm action={action} onSuccess={close}>
          <Alert tone="danger" title="Permanent and irreversible">
            Name, email, phone and password are erased, sessions are revoked, favourites and shop memberships are removed, and shops this person solely
            owns are suspended. Enquiry messages stay with the shop, detached from identity.
          </Alert>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirm-delete">
              Type <strong>{DELETE_CONFIRM_WORD}</strong> to confirm
            </Label>
            <Input id="confirm-delete" name="confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            {typed === DELETE_CONFIRM_WORD ? (
              <SubmitButton variant="danger">Delete account</SubmitButton>
            ) : (
              <Button variant="danger" disabled>
                Delete account
              </Button>
            )}
          </div>
        </ActionForm>
      )}
    </Dialog>
  );
}
