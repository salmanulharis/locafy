"use client";

import { createContext, useActionState, useContext, useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import type { ActionState } from "@/lib/actions";
import { Alert } from "@/components/ui/primitives";
import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/button";
import { useToast } from "@/components/feedback/toaster";
import { cn } from "@/lib/cn";

export type FormAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

const FormStateContext = createContext<ActionState>({ ok: false });

export function useFormState() {
  return useContext(FormStateContext);
}

type Props = {
  action: FormAction;
  children: ReactNode;
  className?: string;
  /** Toast shown on success (falls back to the action's message). */
  successMessage?: string;
  /** Navigate after success. */
  redirectTo?: string;
  resetOnSuccess?: boolean;
  /** Show the form-level error banner (default true). */
  showErrors?: boolean;
  onSuccess?: (state: ActionState) => void;
  id?: string;
  encType?: "multipart/form-data";
};

/**
 * Progressive-enhancement form around a server action. Works without JS
 * (plain POST) and, with JS, shows inline field errors and toasts.
 */
export function ActionForm({ action, children, className, successMessage, redirectTo, resetOnSuccess, showErrors = true, onSuccess, id, encType }: Props) {
  const [state, formAction] = useActionState(action, { ok: false });
  const toast = useToast();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const lastAt = useRef<number | undefined>(undefined);
  const allowReset = useRef(false);

  // React 19 resets uncontrolled fields after every action; block that so a
  // validation error never wipes what the user typed. We reset explicitly on success.
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const onReset = (e: Event) => {
      if (!allowReset.current) e.preventDefault();
    };
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, []);

  useEffect(() => {
    if (!state.at || state.at === lastAt.current) return;
    lastAt.current = state.at;
    if (state.ok) {
      const msg = successMessage ?? state.message;
      if (msg) toast({ tone: "success", message: msg });
      if (resetOnSuccess) {
        allowReset.current = true;
        formRef.current?.reset();
        allowReset.current = false;
      }
      onSuccess?.(state);
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    } else if (state.message && !state.fieldErrors) {
      toast({ tone: "error", message: state.message });
    }
  }, [state, successMessage, redirectTo, resetOnSuccess, onSuccess, toast, router]);

  const formError = !state.ok && state.fieldErrors ? (state.fieldErrors._form?.[0] ?? state.message) : null;

  return (
    <FormStateContext.Provider value={state}>
      <form ref={formRef} action={formAction} className={cn("flex flex-col gap-4", className)} noValidate id={id} encType={encType}>
        {showErrors && formError && <Alert tone="danger">{formError}</Alert>}
        {children}
      </form>
    </FormStateContext.Provider>
  );
}

export function SubmitButton({
  children,
  variant = "primary",
  size = "md",
  className,
  name,
  value,
  pendingLabel,
}: {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  name?: string;
  value?: string;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size={size} loading={pending} className={className} name={name} value={value}>
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}
