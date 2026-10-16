"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { useFormState } from "@/components/forms/action-form";
import { FieldError, TextAreaField, TextField } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";

export type CategoryGroup = { label: string; options: { value: string; label: string }[] };

export type ProductDraft = {
  name?: string;
  brand?: string | null;
  model?: string | null;
  variant?: string | null;
  categoryId?: string | null;
  description?: string | null;
  specs?: Record<string, string>;
  aliases?: string[];
  gtin?: string | null;
};

/** Category select grouped by parent category. */
export function CategorySelect({ name, groups, defaultValue }: { name: string; groups: CategoryGroup[]; defaultValue?: string | null }) {
  const state = useFormState();
  const error = state.fieldErrors?.[name];
  return (
    <Field label="Category" htmlFor={name} error={error}>
      <Select id={name} name={name} defaultValue={defaultValue ?? ""} aria-invalid={error ? true : undefined} required>
        <option value="">Choose a category</option>
        {groups.map((g) =>
          g.options.length === 1 && g.options[0]!.label === g.label ? (
            <option key={g.options[0]!.value} value={g.options[0]!.value}>
              {g.label}
            </option>
          ) : (
            <optgroup key={g.label} label={g.label}>
              {g.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </optgroup>
          ),
        )}
      </Select>
    </Field>
  );
}

/** Editable key/value specification rows (submitted as specKey[] / specValue[]). */
export function SpecRows({ initial }: { initial?: Record<string, string> }) {
  const [rows, setRows] = useState(() => {
    const r = Object.entries(initial ?? {}).map(([k, v], i) => ({ id: i, k, v }));
    return r.length ? r : [{ id: 0, k: "", v: "" }];
  });
  const [nextId, setNextId] = useState(rows.length);
  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="text-sm font-medium">
        Specifications <span className="font-normal text-muted">(optional)</span>
      </legend>
      <p className="text-sm text-muted">E.g. “RAM” → “8 GB”, “Colour” → “Black”. Up to 30 rows.</p>
      {rows.map((r, i) => (
        <div key={r.id} className="flex items-center gap-2">
          <Input
            name="specKey[]"
            aria-label={`Specification ${i + 1} name`}
            placeholder="Name"
            defaultValue={r.k}
            maxLength={40}
            className="min-w-0 flex-[2]"
          />
          <Input
            name="specValue[]"
            aria-label={`Specification ${i + 1} value`}
            placeholder="Value"
            defaultValue={r.v}
            maxLength={200}
            className="min-w-0 flex-[3]"
          />
          <Button variant="ghost" size="icon" aria-label={`Remove specification ${i + 1}`} onClick={() => setRows((x) => x.filter((y) => y.id !== r.id))}>
            <X className="size-4" />
          </Button>
        </div>
      ))}
      <FieldError name="product.specs" />
      {rows.length < 30 && (
        <div>
          <Button
            variant="outline"
            size="sm"
            icon={<Plus className="size-4" aria-hidden />}
            onClick={() => {
              setRows((x) => [...x, { id: nextId, k: "", v: "" }]);
              setNextId((n) => n + 1);
            }}
          >
            Add specification
          </Button>
        </div>
      )}
    </fieldset>
  );
}

/** Catalogue product fields, named product.<field> to line up with service field errors. */
export function ProductFields({ groups, initial }: { groups: CategoryGroup[]; initial?: ProductDraft }) {
  return (
    <div className="flex flex-col gap-4">
      <TextField name="product.name" label="Product name" defaultValue={initial?.name ?? ""} required maxLength={140} hint="E.g. “Galaxy A15 5G”. Don't include the price or offers." />
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField name="product.brand" label="Brand" optional defaultValue={initial?.brand ?? ""} maxLength={60} />
        <TextField name="product.model" label="Model number" optional defaultValue={initial?.model ?? ""} maxLength={80} />
        <TextField name="product.variant" label="Variant" optional defaultValue={initial?.variant ?? ""} maxLength={80} hint="Size, colour or storage" />
      </div>
      <CategorySelect name="product.categoryId" groups={groups} defaultValue={initial?.categoryId} />
      <TextAreaField name="product.description" label="Description" optional defaultValue={initial?.description ?? ""} rows={4} maxLength={4000} />
      <SpecRows initial={initial?.specs} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="product.aliases"
          label="Other names customers search for"
          optional
          defaultValue={initial?.aliases?.join(", ") ?? ""}
          hint="Comma-separated, e.g. “A15, Samsung A15”"
        />
        <TextField name="product.gtin" label="Barcode (GTIN / EAN)" optional inputMode="numeric" defaultValue={initial?.gtin ?? ""} hint="8–14 digits, from the box" />
      </div>
    </div>
  );
}
