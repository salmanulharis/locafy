"use client";

import Link from "next/link";
import { useFormState } from "@/components/forms/action-form";
import { Alert } from "@/components/ui/primitives";

/**
 * Inline notice for errors that need more than a toast: plan limits (with a
 * link to the Plan page) and concurrent edits. Place inside an ActionForm.
 */
export function FormNotice({ planHref }: { planHref?: string }) {
  const state = useFormState();
  const code = (state.data as { code?: string } | undefined)?.code;
  if (state.ok || !state.message || !code) return null;
  if (code === "LIMIT_EXCEEDED") {
    return (
      <Alert tone="warning" title="Plan limit reached">
        {state.message}{" "}
        {planHref && (
          <Link href={planHref} className="font-medium underline">
            See your plan
          </Link>
        )}
      </Alert>
    );
  }
  if (code === "CONFLICT") {
    return (
      <Alert tone="warning" title="This was changed elsewhere">
        {state.message}
      </Alert>
    );
  }
  if ((code === "INVALID_STATE" || code === "FORBIDDEN") && !state.fieldErrors) {
    return <Alert tone="danger">{state.message}</Alert>;
  }
  return null;
}
