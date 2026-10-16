"use client";

import { useId, useRef, useState } from "react";
import { Check, Loader2, PackagePlus, Search } from "lucide-react";
import { FieldError } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form";
import { Alert, Card } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { ProductFields, type CategoryGroup } from "./product-fields";

type Suggestion = { id: string; name: string; model: string | null; variant: string | null; brand: string | null };

function label(s: Suggestion) {
  return !s.brand || s.name.toLowerCase().startsWith(s.brand.toLowerCase()) ? s.name : `${s.brand} ${s.name}`;
}

/**
 * Step one of adding a product: reuse an existing catalogue entry (so all shops
 * selling the same item appear together for customers) or describe a new one.
 */
export function CatalogPicker({ groups }: { groups: CategoryGroup[] }) {
  const [mode, setMode] = useState<"search" | "existing" | "new">("search");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [selected, setSelected] = useState<Suggestion | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abort = useRef<AbortController | null>(null);
  const listId = useId();

  function search(q: string) {
    setQuery(q);
    setActive(-1);
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) {
      setItems([]);
      setSearched(false);
      setOpen(false);
      return;
    }
    timer.current = setTimeout(async () => {
      abort.current?.abort();
      const ctrl = new AbortController();
      abort.current = ctrl;
      setLoading(true);
      try {
        const res = await fetch(`/api/v1/catalog/suggest?q=${encodeURIComponent(q.trim())}`, { signal: ctrl.signal });
        const json = (await res.json()) as { data?: Suggestion[] };
        setItems(json.data ?? []);
        setSearched(true);
        setOpen(true);
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setItems([]);
          setSearched(true);
        }
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 250);
  }

  function choose(s: Suggestion) {
    setSelected(s);
    setMode("existing");
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || !items.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a <= 0 ? items.length - 1 : a - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      choose(items[active]!);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <input type="hidden" name="mode" value={mode} />
      <Alert tone="info">
        Each variant is a separate product: list “8 GB / 128 GB, Black” and “8 GB / 256 GB, Blue” separately so customers see the right price and stock.
      </Alert>

      {mode === "existing" && selected ? (
        <Card className="flex items-center gap-3 p-3">
          <input type="hidden" name="catalogProductId" value={selected.id} />
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-success-soft text-success-soft-fg">
            <Check className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-medium">{label(selected)}</p>
            <p className="text-sm text-muted">{[selected.model, selected.variant].filter(Boolean).join(" · ") || "From the Locafy catalogue"}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setMode("search")}>
            Change
          </Button>
        </Card>
      ) : mode === "new" ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">New product details</p>
            <Button variant="ghost" size="sm" onClick={() => setMode("search")} icon={<Search className="size-4" aria-hidden />}>
              Search the catalogue instead
            </Button>
          </div>
          <ProductFields groups={groups} initial={{ name: query.trim() }} />
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="catalog-search">Find the product</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" aria-hidden />
            <Input
              id="catalog-search"
              type="search"
              role="combobox"
              autoComplete="off"
              aria-expanded={open}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
              aria-describedby="catalog-search-hint"
              placeholder="Type a product name, brand or model"
              value={query}
              onChange={(e) => search(e.target.value)}
              onKeyDown={onKeyDown}
              onFocus={() => items.length && setOpen(true)}
              className="pr-9 pl-9"
            />
            {loading && <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-subtle" aria-label="Searching" />}
            {open && items.length > 0 && (
              <ul id={listId} role="listbox" aria-label="Catalogue matches" className="absolute inset-x-0 z-20 mt-1 max-h-80 overflow-y-auto rounded-xl border border-border bg-surface p-1 shadow-lg">
                {items.map((s, i) => (
                  <li
                    key={s.id}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={i === active}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => choose(s)}
                    className={cn("flex min-h-11 cursor-pointer flex-col justify-center rounded-lg px-3 py-1.5 text-sm", i === active ? "bg-primary-soft" : "hover:bg-surface-2")}
                  >
                    <span className="font-medium">{label(s)}</span>
                    {(s.model || s.variant) && <span className="text-xs text-muted">{[s.model, s.variant].filter(Boolean).join(" · ")}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p id="catalog-search-hint" className="text-sm text-muted" aria-live="polite">
            {searched && !loading && items.length === 0
              ? "No matching product in the catalogue. Add it as a new product below."
              : "Choosing an existing product groups your price with other shops selling the same item."}
          </p>
          <div className="mt-2">
            <Button variant="outline" onClick={() => setMode("new")} icon={<PackagePlus className="size-4" aria-hidden />}>
              Add a new product{query.trim().length >= 2 ? ` “${query.trim()}”` : ""}
            </Button>
          </div>
        </div>
      )}
      <FieldError name="product" />
      <FieldError name="catalogProductId" />
    </div>
  );
}
