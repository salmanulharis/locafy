"use client";

import type { ComponentProps, ReactNode } from "react";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { useFormState } from "./action-form";

function useFieldError(name: string) {
  const state = useFormState();
  return state.fieldErrors?.[name];
}

type Common = { name: string; label: ReactNode; hint?: ReactNode; optional?: boolean; className?: string };

export function TextField({ name, label, hint, optional, className, ...rest }: Common & Omit<ComponentProps<"input">, "name">) {
  const error = useFieldError(name);
  return (
    <Field label={label} htmlFor={rest.id ?? name} hint={hint} error={error} optional={optional} className={className}>
      <Input
        id={rest.id ?? name}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${rest.id ?? name}-error` : hint ? `${rest.id ?? name}-hint` : undefined}
        {...rest}
      />
    </Field>
  );
}

export function TextAreaField({ name, label, hint, optional, className, ...rest }: Common & Omit<ComponentProps<"textarea">, "name">) {
  const error = useFieldError(name);
  return (
    <Field label={label} htmlFor={rest.id ?? name} hint={hint} error={error} optional={optional} className={className}>
      <Textarea
        id={rest.id ?? name}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${rest.id ?? name}-error` : hint ? `${rest.id ?? name}-hint` : undefined}
        {...rest}
      />
    </Field>
  );
}

export function SelectField({
  name,
  label,
  hint,
  optional,
  className,
  options,
  placeholder,
  ...rest
}: Common & Omit<ComponentProps<"select">, "name"> & { options: { value: string; label: string }[]; placeholder?: string }) {
  const error = useFieldError(name);
  return (
    <Field label={label} htmlFor={rest.id ?? name} hint={hint} error={error} optional={optional} className={className}>
      <Select id={rest.id ?? name} name={name} aria-invalid={error ? true : undefined} aria-describedby={error ? `${rest.id ?? name}-error` : undefined} {...rest}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </Field>
  );
}

export function CheckboxField({ name, label, ...rest }: { name: string; label: ReactNode } & Omit<ComponentProps<"input">, "name">) {
  return <Checkbox name={name} label={label} {...rest} />;
}

/** Shows the error for a field that is rendered with custom markup. */
export function FieldError({ name }: { name: string }) {
  const error = useFieldError(name);
  if (!error?.length) return null;
  return (
    <p className="text-sm text-danger-soft-fg" role="alert">
      {error[0]}
    </p>
  );
}
