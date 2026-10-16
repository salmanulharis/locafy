import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/primitives";
import { CategoryIcon } from "@/components/shops/category-grid";
import { listCategories } from "@/modules/catalog/service";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const all = await listCategories();
  const parents = all.filter((c) => !c.parentId);
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <PageHeader title="Categories" />
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {parents.map((p) => {
          const children = all.filter((c) => c.parentId === p.id);
          return (
            <li key={p.id} className="rounded-xl border border-border bg-surface p-4">
              <Link href={`/search?category=${p.slug}`} className="flex items-center gap-3 font-semibold hover:text-primary">
                <span className="flex size-10 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-fg">
                  <CategoryIcon name={p.icon} />
                </span>
                {p.name}
              </Link>
              {children.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {children.map((c) => (
                    <li key={c.id}>
                      <Link href={`/search?category=${c.slug}`} className="inline-flex min-h-9 items-center rounded-lg bg-surface-2 px-3 text-sm hover:bg-border">
                        {c.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
