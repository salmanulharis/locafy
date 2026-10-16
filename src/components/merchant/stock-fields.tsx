"use client";

import { useState } from "react";
import { SelectField, TextField } from "@/components/forms/fields";
import { cn } from "@/lib/cn";

export const STOCK_STATUS_OPTIONS = [
  { value: "in_stock", label: "In stock" },
  { value: "low_stock", label: "Low stock" },
  { value: "out_of_stock", label: "Out of stock" },
  { value: "unknown", label: "Not sure / not confirmed" },
];

/**
 * Price + stock for a new listing. Merchants either track an exact quantity
 * (status is derived) or set the status explicitly.
 */
export function StockFields({ branches, prefix = "stock.0" }: { branches: { id: string; name: string; hasLocation: boolean }[]; prefix?: string }) {
  const [mode, setMode] = useState<"quantity" | "status">("quantity");
  const radio = (value: "quantity" | "status", title: string, text: string) => (
    <label
      className={cn(
        "flex min-h-11 flex-1 cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm",
        mode === value ? "border-primary bg-primary-soft/50" : "border-border",
      )}
    >
      <input type="radio" name="stockMode" value={value} checked={mode === value} onChange={() => setMode(value)} className="mt-0.5 size-5 accent-[var(--primary)]" />
      <span>
        <span className="block font-medium">{title}</span>
        <span className="text-muted">{text}</span>
      </span>
    </label>
  );
  return (
    <div className="flex flex-col gap-4">
      {branches.length > 1 ? (
        <SelectField
          name={`${prefix}.branchId`}
          label="Branch"
          defaultValue={branches[0]?.id}
          options={branches.map((b) => ({ value: b.id, label: b.name + (b.hasLocation ? "" : " (no map location)") }))}
          hint="You can add stock at other branches after saving."
        />
      ) : (
        <input type="hidden" name={`${prefix}.branchId`} value={branches[0]?.id ?? ""} />
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name={`${prefix}.price`} label="Selling price (₹)" inputMode="decimal" required placeholder="e.g. 14999" />
        <TextField name={`${prefix}.mrp`} label="MRP (₹)" optional inputMode="decimal" hint="Printed maximum retail price, if higher" />
      </div>
      <div className="flex flex-col gap-2 sm:flex-row" role="radiogroup" aria-label="How do you track stock?">
        {radio("quantity", "Track quantity", "Enter how many you have; status updates automatically.")}
        {radio("status", "Just set availability", "Choose in stock / low / out of stock yourself.")}
      </div>
      {mode === "quantity" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField name={`${prefix}.quantity`} label="Quantity in stock" type="number" min={0} inputMode="numeric" optional hint="Leave empty if you don't count stock" />
          <TextField name={`${prefix}.lowStockThreshold`} label="Low-stock alert at" type="number" min={0} inputMode="numeric" defaultValue="3" hint="Shown as “Low stock” at or below this number" />
        </div>
      ) : (
        <SelectField name={`${prefix}.stockStatus`} label="Availability" defaultValue="in_stock" options={STOCK_STATUS_OPTIONS} />
      )}
    </div>
  );
}
