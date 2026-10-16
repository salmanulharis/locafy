import Link from "next/link";
import { FolderTree, Pencil, Plus } from "lucide-react";
import { flattenCategories } from "@/components/admin/category-tree";
import { strParam } from "@/components/admin/filters";
import { DASH } from "@/components/admin/format";
import { Panel } from "@/components/admin/panel";
import { StatusBadge } from "@/components/admin/status-badge";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { CheckboxField, SelectField, TextField } from "@/components/forms/fields";
import { LinkButton } from "@/components/ui/button";
import { Badge, EmptyState, PageHeader } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { listCategories } from "@/modules/catalog/service";
import { saveCategoryAction } from "../actions";
import { adminCtx } from "../_lib/guard";

export const metadata = { title: "Categories" };

export default async function AdminCategoriesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await adminCtx("/admin/categories");
  const sp = await searchParams;
  const editId = strParam(sp.edit);
  const all = await listCategories({ includeInactive: true });
  const tree = flattenCategories(all);
  const editing = editId ? all.find((c) => c.id === editId) : undefined;

  // A category cannot be moved under itself or one of its descendants.
  const blocked = new Set<string>();
  if (editing) {
    blocked.add(editing.id);
    let grew = true;
    while (grew) {
      grew = false;
      for (const c of all) {
        if (c.parentId && blocked.has(c.parentId) && !blocked.has(c.id)) {
          blocked.add(c.id);
          grew = true;
        }
      }
    }
  }
  const parentOptions = tree.filter((c) => !blocked.has(c.id)).map((c) => ({ value: c.id, label: c.path }));

  return (
    <>
      <PageHeader
        title="Categories"
        description="The taxonomy used for products and shops. Category names feed product search."
        actions={
          editing ? (
            <LinkButton href="/admin/categories" variant="outline" icon={<Plus className="size-4" aria-hidden />}>
              New category
            </LinkButton>
          ) : undefined
        }
      />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <Panel title={`All categories (${all.length})`}>
          {tree.length === 0 ? (
            <EmptyState icon={<FolderTree className="size-5" aria-hidden />} title="No categories yet" description="Create the first category with the form." />
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {tree.map((c) => (
                <li key={c.id} className={cn("flex items-center gap-3 py-2", editing?.id === c.id && "bg-primary-soft/40")}>
                  <div className="min-w-0 flex-1" style={{ paddingLeft: `${Math.min(c.depth, 5) * 1.25}rem` }}>
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      {c.depth > 0 && <span className="text-subtle" aria-hidden>└</span>}
                      {c.name}
                      {!c.isActive && <StatusBadge status="inactive" />}
                      <Badge>{c.scope === "both" ? "Products & shops" : c.scope === "product" ? "Products" : "Shops"}</Badge>
                    </p>
                    <p className="text-xs text-muted">
                      /{c.slug} · icon {c.icon ?? DASH} · sort {c.sortOrder}
                    </p>
                  </div>
                  <Link
                    href={`/admin/categories?edit=${c.id}`}
                    className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg"
                    aria-label={`Edit ${c.name}`}
                  >
                    <Pencil className="size-4" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="xl:sticky xl:top-20 xl:self-start">
          <Panel title={editing ? `Edit “${editing.name}”` : "New category"}>
            <ActionForm
              key={editing?.id ?? "new"}
              action={saveCategoryAction.bind(null, editing?.id ?? null)}
              redirectTo={editing ? "/admin/categories" : undefined}
              resetOnSuccess={!editing}
            >
              <TextField name="name" label="Name" defaultValue={editing?.name} required maxLength={60} />
              <TextField name="slug" label="Slug" optional defaultValue={editing?.slug} maxLength={60} hint="Leave empty to derive from the name." />
              <SelectField name="parentId" label="Parent" defaultValue={editing?.parentId ?? ""} placeholder="None (top level)" options={parentOptions} />
              <TextField name="icon" label="Icon" optional defaultValue={editing?.icon ?? ""} maxLength={40} hint="A lucide icon name, e.g. smartphone, shirt, utensils." />
              <div className="grid grid-cols-2 gap-4">
                <TextField name="sortOrder" label="Sort order" type="number" min={0} max={1000} inputMode="numeric" defaultValue={String(editing?.sortOrder ?? 0)} />
                <SelectField
                  name="scope"
                  label="Applies to"
                  defaultValue={editing?.scope ?? "both"}
                  options={[
                    { value: "both", label: "Products & shops" },
                    { value: "product", label: "Products" },
                    { value: "shop", label: "Shops" },
                  ]}
                />
              </div>
              <CheckboxField name="isActive" label="Active (visible to customers and merchants)" defaultChecked={editing ? editing.isActive : true} />
              <div className="flex flex-wrap gap-2">
                <SubmitButton>{editing ? "Save category" : "Create category"}</SubmitButton>
                {editing && (
                  <LinkButton href="/admin/categories" variant="ghost">
                    Cancel
                  </LinkButton>
                )}
              </div>
            </ActionForm>
          </Panel>
        </div>
      </div>
    </>
  );
}
