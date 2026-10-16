"use client";

import type { ComponentProps } from "react";

/** A select that submits its form on change (the form keeps a <noscript> submit button). */
export function AutoSubmitSelect(props: ComponentProps<"select">) {
  return <select {...props} onChange={(e) => e.currentTarget.form?.requestSubmit()} />;
}
