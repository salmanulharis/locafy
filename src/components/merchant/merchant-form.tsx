"use client";

import type { ComponentProps } from "react";
import { ActionForm } from "@/components/forms/action-form";
import { FormNotice } from "./form-notice";

type Props = ComponentProps<typeof ActionForm> & {
  /** Plan page link for LIMIT_EXCEEDED notices; pass `false` to hide the inline notice. */
  planHref?: string | false;
};

/** ActionForm + inline limit/conflict notice (value preservation lives in ActionForm). */
export function MerchantForm({ planHref, children, ...rest }: Props) {
  return (
    <ActionForm {...rest}>
      {planHref !== false && <FormNotice planHref={planHref || undefined} />}
      {children}
    </ActionForm>
  );
}
