import { Tags, Trash2 } from "lucide-react";
import { SearchForm, strParam } from "@/components/admin/filters";
import { formatNumber } from "@/components/admin/format";
import { Panel } from "@/components/admin/panel";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { ConfirmAction } from "@/components/forms/confirm-action";
import { TextField } from "@/components/forms/fields";
import { EmptyState, PageHeader } from "@/components/ui/primitives";
import { listBrands, listSynonyms } from "@/modules/administration/service";
import { deleteSynonymAction, saveSynonymAction, setBrandAliasesAction } from "../actions";
import { adminCtx } from "../_lib/guard";

export const metadata = { title: "Brands & synonyms" };

export default async function AdminBrandsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await adminCtx("/admin/brands");
  const sp = await searchParams;
  const q = strParam(sp.q)?.toLowerCase();
  const [brands, synonyms] = await Promise.all([listBrands(ctx), listSynonyms(ctx)]);
  const shown = q ? brands.filter((b) => b.name.toLowerCase().includes(q) || b.aliases.some((a) => a.includes(q))) : brands;

  return (
    <>
      <PageHeader title="Brands & synonyms" description="Improve search recall: brand aliases match alternative spellings, synonyms expand query terms." />
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title={`Brands (${brands.length})`} description="Aliases are normalised to lowercase slugs, e.g. “samsung-electronics”. Saving refreshes product search text.">
          <SearchForm action="/admin/brands" q={q} placeholder="Filter brands" label="Filter brands" />
          {shown.length === 0 ? (
            <EmptyState icon={<Tags className="size-5" aria-hidden />} title="No brands" description={q ? `No brand matches "${q}".` : "Brands are created when products are added."} className="py-6" />
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {shown.map((b) => (
                <li key={b.id} className="py-3 first:pt-0">
                  <p className="mb-2 text-sm">
                    <span className="font-medium">{b.name}</span>
                    <span className="text-muted">
                      {" "}
                      · /{b.slug} · {formatNumber(b.productCount)} product{b.productCount === 1 ? "" : "s"}
                    </span>
                  </p>
                  <ActionForm action={setBrandAliasesAction.bind(null, b.id)} className="gap-2 sm:flex-row sm:items-end">
                    <TextField
                      id={`aliases-${b.id}`}
                      name="aliases"
                      label={<span className="sr-only">{`Aliases for ${b.name}`}</span>}
                      defaultValue={b.aliases.join(", ")}
                      placeholder="Comma-separated aliases"
                      className="min-w-0 flex-1"
                      maxLength={500}
                    />
                    <SubmitButton variant="outline">Save</SubmitButton>
                  </ActionForm>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={`Search synonyms (${synonyms.length})`} description="When a customer searches the term, results for its synonyms are included too. Saving an existing term replaces its synonyms.">
          <ActionForm action={saveSynonymAction} resetOnSuccess className="mb-4 rounded-lg bg-surface-2 p-3">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <TextField id="new-term" name="term" label="Term" placeholder="mobile" required maxLength={40} />
              <TextField id="new-synonyms" name="synonyms" label="Synonyms" placeholder="phone, smartphone, cell phone" required maxLength={400} hint="Comma-separated, up to 15." />
            </div>
            <div>
              <SubmitButton>Add synonym</SubmitButton>
            </div>
          </ActionForm>
          {synonyms.length === 0 ? (
            <EmptyState title="No synonyms yet" description="Add a term above." className="py-6" />
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {synonyms.map((s) => (
                <li key={s.id} className="flex flex-col gap-1 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">{s.term}</p>
                    <ConfirmAction
                      action={deleteSynonymAction.bind(null, s.id)}
                      label={<span className="sr-only">{`Delete synonym ${s.term}`}</span>}
                      icon={<Trash2 className="size-4" aria-hidden />}
                      title={`Delete synonyms for “${s.term}”?`}
                      description="Searches for this term will no longer be expanded."
                      confirmLabel="Delete"
                      variant="ghost"
                      size="icon"
                    />
                  </div>
                  <ActionForm action={saveSynonymAction} className="gap-2">
                    <input type="hidden" name="term" value={s.term} />
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                      <TextField
                        id={`syn-${s.id}`}
                        name="synonyms"
                        label={<span className="sr-only">{`Synonyms for ${s.term}`}</span>}
                        defaultValue={s.synonyms.join(", ")}
                        className="min-w-0 flex-1"
                        maxLength={400}
                      />
                      <SubmitButton variant="outline">Save</SubmitButton>
                    </div>
                  </ActionForm>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
