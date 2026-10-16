"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { FieldError } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";

type Row = { id: number; key: string; value: string };

/** Key/value specification editor; submits `specKey[]` / `specValue[]` pairs. */
export function SpecsEditor({ initial }: { initial: Record<string, string> }) {
  const [rows, setRows] = useState<Row[]>(() => {
    const entries = Object.entries(initial ?? {});
    return (entries.length ? entries : [["", ""]]).map(([key, value], i) => ({ id: i, key, value }));
  });
  const [nextId, setNextId] = useState(rows.length);

  const add = () => {
    setRows((r) => [...r, { id: nextId, key: "", value: "" }]);
    setNextId((n) => n + 1);
  };

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-sm font-medium">
        Specifications <span className="font-normal text-muted">(optional)</span>
      </legend>
      {rows.map((row, i) => (
        <div key={row.id} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto] gap-2">
          <Input name="specKey[]" defaultValue={row.key} placeholder="e.g. RAM" aria-label={`Specification ${i + 1} name`} maxLength={40} />
          <Input name="specValue[]" defaultValue={row.value} placeholder="e.g. 8 GB" aria-label={`Specification ${i + 1} value`} maxLength={200} />
          <Button variant="ghost" size="icon" aria-label={`Remove specification ${i + 1}`} onClick={() => setRows((r) => r.filter((x) => x.id !== row.id))}>
            <Trash2 className="size-4" aria-hidden />
          </Button>
        </div>
      ))}
      <FieldError name="specs" />
      <div>
        <Button variant="outline" size="md" onClick={add} icon={<Plus className="size-4" aria-hidden />} disabled={rows.length >= 30}>
          Add specification
        </Button>
      </div>
    </fieldset>
  );
}
