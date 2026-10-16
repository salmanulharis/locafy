"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, LayoutGrid, Search, X } from "lucide-react";
import { cn } from "@/lib/cn";

type Suggestions = { products: { slug: string; name: string; brand: string | null; variant: string | null }[]; categories: { slug: string; name: string }[] };

const RECENT_KEY = "locafy_recent_searches";

function loadRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]").slice(0, 5);
  } catch {
    return [];
  }
}

function saveRecent(q: string) {
  try {
    const list = [q, ...loadRecent().filter((r) => r.toLowerCase() !== q.toLowerCase())].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    // storage unavailable
  }
}

/**
 * Product search field with suggestions (combobox pattern). Submits to
 * /search; works as a plain GET form without JavaScript.
 */
export function SearchBox({ defaultValue = "", autoFocus, className, size = "md" }: { defaultValue?: string; autoFocus?: boolean; className?: string; size?: "md" | "lg" }) {
  const router = useRouter();
  const [q, setQ] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Suggestions>({ products: [], categories: [] });
  const [recent, setRecent] = useState<string[]>([]);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Keep the field in sync when navigation changes the query (adjust state during render).
  const [syncedDefault, setSyncedDefault] = useState(defaultValue);
  if (syncedDefault !== defaultValue) {
    setSyncedDefault(defaultValue);
    setQ(defaultValue);
  }

  useEffect(() => {
    clearTimeout(timer.current);
    const term = q.trim();
    if (term.length < 2) return;
    const ctrl = new AbortController();
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v1/search/suggest?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        if (res.ok) setData((await res.json()).data);
      } catch {
        // suggestions are optional
      }
    }, 180);
    return () => {
      clearTimeout(timer.current);
      ctrl.abort();
    };
  }, [q]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const showRecent = q.trim().length < 2 && recent.length > 0;
  const items: { key: string; label: string; detail?: string; href: string; kind: "recent" | "product" | "category" }[] = showRecent
    ? recent.map((r) => ({ key: `r-${r}`, label: r, href: `/search?q=${encodeURIComponent(r)}`, kind: "recent" }))
    : [
        ...(q.trim().length < 2 ? [] : data.categories).map((c) => ({ key: `c-${c.slug}`, label: c.name, detail: "Category", href: `/search?category=${c.slug}`, kind: "category" as const })),
        ...(q.trim().length < 2 ? [] : data.products).map((p) => ({
          key: `p-${p.slug}`,
          label: p.name,
          detail: [p.brand, p.variant].filter(Boolean).join(" · ") || undefined,
          href: `/p/${p.slug}`,
          kind: "product" as const,
        })),
      ];

  function go(href: string, term?: string) {
    if (term) saveRecent(term);
    setOpen(false);
    router.push(href);
  }

  return (
    <div ref={wrap} className={cn("relative w-full", className)}>
      <form
        role="search"
        action="/search"
        onSubmit={(e) => {
          e.preventDefault();
          if (active >= 0 && items[active]) return go(items[active]!.href, items[active]!.kind === "recent" ? items[active]!.label : undefined);
          const term = q.trim();
          if (!term) return;
          go(`/search?q=${encodeURIComponent(term)}`, term);
        }}
      >
        <label htmlFor={`${listId}-input`} className="sr-only">
          Search for a product
        </label>
        <Search className={cn("pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted", size === "lg" ? "size-5" : "size-4")} aria-hidden />
        <input
          id={`${listId}-input`}
          name="q"
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          autoFocus={autoFocus}
          value={q}
          placeholder="Search for a product, brand or model"
          onFocus={() => {
            setRecent(loadRecent());
            setOpen(true);
          }}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(items.length - 1, a + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(-1, a - 1));
            } else if (e.key === "Escape") setOpen(false);
          }}
          role="combobox"
          aria-expanded={open && items.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          className={cn(
            "w-full rounded-xl border border-border-strong bg-surface pr-10 text-fg shadow-xs placeholder:text-muted focus:border-primary focus:outline-2 focus:outline-ring/40 [&::-webkit-search-cancel-button]:hidden",
            size === "lg" ? "h-13 pl-11 text-base" : "h-11 pl-10 text-[0.9375rem]",
          )}
        />
        {q && (
          <button type="button" onClick={() => setQ("")} className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1.5 text-muted hover:text-fg" aria-label="Clear search">
            <X className="size-4" />
          </button>
        )}
      </form>
      {open && items.length > 0 && (
        <ul id={listId} role="listbox" className="absolute inset-x-0 top-full z-40 mt-1.5 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-lg">
          {showRecent && <li className="px-3.5 pt-1.5 pb-1 text-xs font-medium text-muted">Recent searches</li>}
          {items.map((it, i) => (
            <li key={it.key} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => go(it.href, it.kind === "recent" ? it.label : undefined)}
                className={cn("flex min-h-11 w-full items-center gap-3 px-3.5 py-2 text-left text-sm hover:bg-surface-2", i === active && "bg-surface-2")}
              >
                {it.kind === "recent" ? <Clock className="size-4 text-muted" aria-hidden /> : it.kind === "category" ? <LayoutGrid className="size-4 text-muted" aria-hidden /> : <Search className="size-4 text-muted" aria-hidden />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{it.label}</span>
                  {it.detail && <span className="block truncate text-xs text-muted">{it.detail}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
