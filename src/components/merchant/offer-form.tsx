"use client";

import { useMemo, useRef, useState } from "react";
import { CalendarClock, Search, Tag } from "lucide-react";
import { SubmitButton, useFormState, type FormAction } from "@/components/forms/action-form";
import { MerchantForm } from "./merchant-form";
import { FieldError, TextAreaField, TextField } from "@/components/forms/fields";
import { Field, Input, Label } from "@/components/ui/form";
import { Badge, Card } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { formatMoney, toMajorInput } from "@/lib/money";
import { describeOffer, type DiscountType } from "@/modules/offers/rules";

export type OfferInitial = {
  title: string;
  description: string | null;
  conditions: string | null;
  discountType: DiscountType;
  /** Stored value: whole percent, or minor units for amounts. */
  discountValue: number;
  startsAt: string;
  endsAt: string;
  listingIds: string[];
};

type ListingOption = { id: string; name: string; variant: string | null; status: string };

const IST_OFFSET_MIN = 330;

/** yyyy-MM-ddTHH:mm in India Standard Time (deterministic for server render). */
function toIstInput(iso: string) {
  const d = new Date(new Date(iso).getTime() + IST_OFFSET_MIN * 60_000);
  return d.toISOString().slice(0, 16);
}

/** yyyy-MM-ddTHH:mm in the browser's own time zone. */
function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * datetime-local input whose value is interpreted in the browser's time zone;
 * a hidden input carries the exact ISO instant to the server.
 */
function DateTimeField({ name, label, initialIso, onChange }: { name: "startsAt" | "endsAt"; label: string; initialIso: string; onChange: (iso: string | null) => void }) {
  const hidden = useRef<HTMLInputElement>(null);
  const inited = useRef(false);
  const state = useFormState();
  const error = state.fieldErrors?.[name];
  const id = `${name}-input`;
  return (
    <Field label={label} htmlFor={id} error={error}>
      <input ref={hidden} type="hidden" name={name} />
      <Input
        id={id}
        type="datetime-local"
        name={`${name}Local`}
        defaultValue={toIstInput(initialIso)}
        aria-invalid={error ? true : undefined}
        ref={(el) => {
          // Once, after mount: show the time in the viewer's own zone and record the exact instant.
          if (el && hidden.current && !inited.current) {
            inited.current = true;
            el.value = toLocalInput(initialIso);
            hidden.current.value = new Date(initialIso).toISOString();
          }
        }}
        onChange={(e) => {
          const v = e.target.value;
          const iso = v ? new Date(v).toISOString() : "";
          if (hidden.current) hidden.current.value = iso;
          onChange(iso || null);
        }}
        required
      />
    </Field>
  );
}

function endsLabel(endIso: string | null) {
  if (!endIso) return "";
  const end = new Date(endIso);
  return `Until ${new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(end)}`;
}

export function OfferForm({
  action,
  listings,
  initial,
  shopName,
  planHref,
  canPublish,
  isNew,
}: {
  action: FormAction;
  listings: ListingOption[];
  initial: OfferInitial;
  shopName: string;
  planHref: string;
  canPublish: boolean;
  isNew: boolean;
}) {
  const [title, setTitle] = useState(initial.title);
  const [type, setType] = useState<DiscountType>(initial.discountType);
  const [value, setValue] = useState(initial.discountType === "percent" ? String(initial.discountValue || "") : toMajorInput(initial.discountValue || null));
  const [conditions, setConditions] = useState(initial.conditions ?? "");
  const [endIso, setEndIso] = useState<string | null>(initial.endsAt);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initial.listingIds));
  const [filter, setFilter] = useState("");

  const visible = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return f ? listings.filter((l) => `${l.name} ${l.variant ?? ""}`.toLowerCase().includes(f)) : listings;
  }, [filter, listings]);

  const numeric = Number(value.replace(/,/g, ""));
  const validValue = Number.isFinite(numeric) && numeric > 0;
  const headline = validValue ? describeOffer(type, type === "percent" ? Math.round(numeric) : Math.round(numeric * 100), (m) => formatMoney(m)) : "Your discount";
  const chosen = listings.filter((l) => selected.has(l.id));

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
      <Card className="p-4 sm:p-6">
        <MerchantForm action={action} planHref={planHref}>
          <TextField name="title" label="Offer title" required maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Festive week discount" />
          <fieldset className="flex min-w-0 flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">Discount</legend>
            <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Discount type">
              {(
                [
                  ["percent", "Percentage off"],
                  ["amount_off", "Amount off (₹)"],
                  ["fixed_price", "Offer price (₹)"],
                ] as const
              ).map(([v, l]) => (
                <label
                  key={v}
                  className={cn("flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm", type === v ? "border-primary bg-primary-soft/50 font-medium" : "border-border")}
                >
                  <input type="radio" name="discountType" value={v} checked={type === v} onChange={() => setType(v)} className="size-5 accent-[var(--primary)]" />
                  {l}
                </label>
              ))}
            </div>
            <TextField
              name="discountValue"
              label={type === "percent" ? "Percentage (1–95)" : type === "amount_off" ? "Amount off (₹)" : "Offer price (₹)"}
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
              hint={type === "fixed_price" ? "Must be lower than the current price of every selected product." : undefined}
            />
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <DateTimeField name="startsAt" label="Starts" initialIso={initial.startsAt} onChange={() => {}} />
            <DateTimeField name="endsAt" label="Ends" initialIso={initial.endsAt} onChange={setEndIso} />
          </div>
          <p className="-mt-2 text-xs text-muted">Times are in your device&apos;s time zone. Scheduling an offer to start later may need a paid plan.</p>
          <TextAreaField name="description" label="Description" optional rows={3} maxLength={500} defaultValue={initial.description ?? ""} />
          <TextAreaField
            name="conditions"
            label="Conditions"
            optional
            rows={2}
            maxLength={500}
            value={conditions}
            onChange={(e) => setConditions(e.target.value)}
            placeholder="e.g. While stocks last. Not valid with other offers."
          />

          <fieldset className="flex min-w-0 flex-col gap-2">
            <legend className="text-sm font-medium">Products in this offer</legend>
            {listings.length === 0 ? (
              <p className="text-sm text-muted">Add products first — offers apply to products you list.</p>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative min-w-0 flex-1">
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" aria-hidden />
                    <Label htmlFor="offer-product-filter" className="sr-only">
                      Filter products
                    </Label>
                    <Input id="offer-product-filter" type="search" placeholder="Filter products" value={filter} onChange={(e) => setFilter(e.target.value)} className="pl-9" />
                  </div>
                  <span className="text-sm text-muted" aria-live="polite">
                    {selected.size} selected
                  </span>
                </div>
                <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-lg border border-border">
                  {visible.map((l) => (
                    <li key={l.id}>
                      <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-surface-2">
                        <input type="checkbox" checked={selected.has(l.id)} onChange={() => toggle(l.id)} className="size-5 accent-[var(--primary)]" />
                        <span className="min-w-0 flex-1">
                          {l.name}
                          {l.variant && <span className="text-muted"> · {l.variant}</span>}
                        </span>
                        {l.status !== "published" && <Badge>{l.status === "draft" ? "Draft" : "Unpublished"}</Badge>}
                      </label>
                    </li>
                  ))}
                  {visible.length === 0 && <li className="px-3 py-3 text-sm text-muted">No products match “{filter}”.</li>}
                </ul>
                {[...selected].map((id) => (
                  <input key={id} type="hidden" name="listingIds[]" value={id} />
                ))}
                <p className="text-xs text-muted">Only published products show the offer to customers.</p>
              </>
            )}
            <FieldError name="listingIds" />
          </fieldset>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {isNew ? (
              <>
                <SubmitButton variant={canPublish ? "outline" : "primary"} name="publish" value="0">
                  Save draft
                </SubmitButton>
                {canPublish && (
                  <SubmitButton name="publish" value="1">
                    Save &amp; publish
                  </SubmitButton>
                )}
              </>
            ) : (
              <SubmitButton>Save changes</SubmitButton>
            )}
          </div>
        </MerchantForm>
      </Card>

      <aside aria-label="Preview" className="lg:sticky lg:top-24">
        <p className="mb-2 text-sm font-medium text-muted">Preview</p>
        <article className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4" aria-live="polite">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-accent px-2 py-0.5 text-sm font-semibold text-accent-fg">
              <Tag className="size-3.5" aria-hidden />
              {headline}
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-muted" suppressHydrationWarning>
              <CalendarClock className="size-3.5" aria-hidden />
              {endsLabel(endIso)}
            </span>
          </div>
          <h3 className="leading-snug font-semibold">{title || "Offer title"}</h3>
          <p className="text-sm text-muted">{shopName}</p>
          {chosen.length > 0 ? (
            <ul className="flex flex-col gap-0.5 text-sm text-primary">
              {chosen.slice(0, 3).map((l) => (
                <li key={l.id} className="truncate">
                  {l.name}
                  {l.variant ? ` (${l.variant})` : ""}
                </li>
              ))}
              {chosen.length > 3 && <li className="text-muted">+{chosen.length - 3} more</li>}
            </ul>
          ) : (
            <p className="text-sm text-muted">No products selected</p>
          )}
          {conditions && <p className="line-clamp-2 text-xs text-muted">{conditions}</p>}
        </article>
        <p className="mt-2 text-xs text-muted">This is how the offer appears to customers near your shop.</p>
      </aside>
    </div>
  );
}
