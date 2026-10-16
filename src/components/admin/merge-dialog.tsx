"use client";

import { useState } from "react";
import { GitMerge } from "lucide-react";
import { ActionForm, SubmitButton, type FormAction } from "@/components/forms/action-form";
import { FieldError } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Alert } from "@/components/ui/primitives";
import { Input, Label } from "@/components/ui/form";

type Candidate = { id: string; name: string; variant: string | null };

/** Merge this (duplicate) product into a canonical one. */
export function MergeProductDialog({ action, productName, candidates }: { action: FormAction; productName: string; candidates: Candidate[] }) {
  const [choice, setChoice] = useState(candidates[0]?.id ?? "");
  const [pasted, setPasted] = useState("");
  const target = pasted.trim() || choice;
  return (
    <Dialog
      title="Merge into another product"
      description={`"${productName}" will become a redirect to the product you choose.`}
      trigger={(open) => (
        <Button variant="outline" size="md" onClick={open} icon={<GitMerge className="size-4" aria-hidden />}>
          Merge…
        </Button>
      )}
    >
      {(close) => (
        <ActionForm action={action} onSuccess={close}>
          <Alert tone="warning" title="This cannot be undone">
            <ul className="list-disc pl-4">
              <li>Shop listings move to the target product.</li>
              <li>If a shop already lists the target, its duplicate listing is archived.</li>
              <li>Prices and stock are never combined between listings.</li>
              <li>Favourites, reviews (one per author) and images follow the target.</li>
            </ul>
          </Alert>
          {candidates.length > 0 && (
            <fieldset className="flex flex-col gap-1">
              <legend className="mb-1 text-sm font-medium">Similar products</legend>
              {candidates.map((c) => (
                <label key={c.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 text-sm hover:bg-surface-2">
                  <input type="radio" name="candidate" value={c.id} checked={!pasted && choice === c.id} onChange={() => { setChoice(c.id); setPasted(""); }} className="size-4 accent-[var(--primary)]" />
                  <span className="min-w-0">
                    <span className="block truncate">{c.name}</span>
                    {c.variant && <span className="block truncate text-xs text-muted">{c.variant}</span>}
                  </span>
                </label>
              ))}
            </fieldset>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="merge-target">{candidates.length ? "…or paste a product ID" : "Target product ID"}</Label>
            <Input id="merge-target" value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="00000000-0000-0000-0000-000000000000" autoComplete="off" />
            <FieldError name="targetId" />
          </div>
          <input type="hidden" name="targetId" value={target} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <SubmitButton variant="danger">Merge products</SubmitButton>
          </div>
        </ActionForm>
      )}
    </Dialog>
  );
}
