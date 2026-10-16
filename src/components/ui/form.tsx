import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

const control =
  "w-full rounded-lg border border-border-strong bg-surface px-3 text-[0.9375rem] text-fg placeholder:text-muted transition-colors focus:border-primary focus:outline-2 focus:outline-offset-0 focus:outline-ring/40 disabled:bg-surface-2 disabled:text-muted aria-[invalid=true]:border-danger";

export function Input({ className, ...rest }: ComponentProps<"input">) {
  return <input className={cn(control, "h-11", className)} {...rest} />;
}

export function Textarea({ className, rows = 4, ...rest }: ComponentProps<"textarea">) {
  return <textarea rows={rows} className={cn(control, "py-2.5 leading-relaxed", className)} {...rest} />;
}

export function Select({ className, children, ...rest }: ComponentProps<"select">) {
  return (
    <select className={cn(control, "h-11 appearance-none bg-[length:1rem] bg-[right_0.75rem_center] bg-no-repeat pr-9", className)} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2364748B' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }} {...rest}>
      {children}
    </select>
  );
}

export function Label({ className, ...rest }: ComponentProps<"label">) {
  return <label className={cn("text-sm font-medium text-fg", className)} {...rest} />;
}

type FieldProps = {
  label: ReactNode;
  htmlFor: string;
  hint?: ReactNode;
  error?: string[] | string;
  optional?: boolean;
  className?: string;
  children: ReactNode;
};

/** Label + control + hint/error with correct aria wiring expectations (control should set aria-describedby). */
export function Field({ label, htmlFor, hint, error, optional, className, children }: FieldProps) {
  const errors = Array.isArray(error) ? error : error ? [error] : [];
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {optional && <span className="ml-1 font-normal text-muted">(optional)</span>}
      </Label>
      {children}
      {errors.length > 0 ? (
        <p id={`${htmlFor}-error`} className="text-sm text-danger-soft-fg" role="alert">
          {errors[0]}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function fieldA11y(name: string, errors?: Record<string, string[]>) {
  const has = Boolean(errors?.[name]?.length);
  return {
    id: name,
    name,
    "aria-invalid": has || undefined,
    "aria-describedby": has ? `${name}-error` : `${name}-hint`,
  } as const;
}

export function Checkbox({ label, className, ...rest }: ComponentProps<"input"> & { label: ReactNode }) {
  return (
    <label className={cn("flex min-h-11 cursor-pointer items-center gap-3 text-sm", className)}>
      <input type="checkbox" className="size-5 rounded border-border-strong accent-[var(--primary)]" {...rest} />
      <span>{label}</span>
    </label>
  );
}

export function FormSection({ title, description, children, className }: { title: string; description?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("grid gap-4 border-b border-border py-6 first:pt-0 last:border-0 md:grid-cols-[minmax(0,15rem)_1fr] md:gap-8", className)}>
      <div>
        <h2 className="text-heading font-semibold">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      <div className="flex min-w-0 flex-col gap-4">{children}</div>
    </section>
  );
}
