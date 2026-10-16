import Link from "next/link";
import { Input, Label, Select } from "@/components/ui/form";
import { buttonClass } from "@/components/ui/button";
import { RADIUS_OPTIONS_KM } from "@/modules/geo/format";

export type FilterValues = {
  q?: string;
  category?: string;
  minPrice?: string;
  maxPrice?: string;
  availability?: string;
  offers?: string;
  minRating?: string;
  sort?: string;
  radiusKm?: string;
  view?: string;
};

/** Plain GET form (works without JavaScript). */
export function FiltersForm({ values, categories, hasLocation, idPrefix }: { values: FilterValues; categories: { slug: string; name: string; parentId: string | null; id: string }[]; hasLocation: boolean; idPrefix: string }) {
  const id = (n: string) => `${idPrefix}-${n}`;
  const parents = categories.filter((c) => !c.parentId);
  return (
    <form action="/search" className="flex flex-col gap-5">
      {values.q && <input type="hidden" name="q" value={values.q} />}
      {values.sort && <input type="hidden" name="sort" value={values.sort} />}
      {values.view && <input type="hidden" name="view" value={values.view} />}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={id("category")}>Category</Label>
        <Select id={id("category")} name="category" defaultValue={values.category ?? ""}>
          <option value="">All categories</option>
          {parents.map((p) => (
            <optgroup key={p.id} label={p.name}>
              <option value={p.slug}>All {p.name}</option>
              {categories
                .filter((c) => c.parentId === p.id)
                .map((c) => (
                  <option key={c.id} value={c.slug}>
                    {c.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </Select>
      </div>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-medium">Price (₹)</legend>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor={id("min")} className="sr-only">
              Minimum price
            </label>
            <Input id={id("min")} name="minPrice" inputMode="decimal" placeholder="Min" defaultValue={values.minPrice} />
          </div>
          <div>
            <label htmlFor={id("max")} className="sr-only">
              Maximum price
            </label>
            <Input id={id("max")} name="maxPrice" inputMode="decimal" placeholder="Max" defaultValue={values.maxPrice} />
          </div>
        </div>
      </fieldset>

      {hasLocation && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id("radius")}>Distance</Label>
          <Select id={id("radius")} name="radiusKm" defaultValue={values.radiusKm ?? ""}>
            <option value="">Default radius</option>
            {RADIUS_OPTIONS_KM.map((r) => (
              <option key={r} value={r}>
                Within {r} km
              </option>
            ))}
          </Select>
        </div>
      )}

      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-sm font-medium">Availability</legend>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input type="radio" name="availability" value="any" defaultChecked={values.availability !== "in_stock"} className="size-4 accent-[var(--primary)]" />
          Show all, including unconfirmed
        </label>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input type="radio" name="availability" value="in_stock" defaultChecked={values.availability === "in_stock"} className="size-4 accent-[var(--primary)]" />
          In stock or low stock only
        </label>
      </fieldset>

      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" name="offers" value="true" defaultChecked={values.offers === "true"} className="size-5 accent-[var(--primary)]" />
        Has an active offer
      </label>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={id("rating")}>Shop rating</Label>
        <Select id={id("rating")} name="minRating" defaultValue={values.minRating ?? ""}>
          <option value="">Any rating</option>
          <option value="4">4★ and above</option>
          <option value="3">3★ and above</option>
        </Select>
      </div>

      <div className="flex gap-2">
        <button type="submit" className={buttonClass("primary", "md", "flex-1")}>
          Apply filters
        </button>
        <Link href={values.q ? `/search?q=${encodeURIComponent(values.q)}` : "/search"} className={buttonClass("ghost", "md")}>
          Reset
        </Link>
      </div>
    </form>
  );
}
