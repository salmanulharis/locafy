import Link from "next/link";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { ShopLogo } from "@/components/shops/shop-card";
import { ShopStatusBadge, type ShopStatus } from "./status";

type ShopLite = { id: string; name: string; status: ShopStatus; logoUrl: string | null; role: string };

/** Shop header for the sidebar; becomes a switcher when the user belongs to several shops. */
export function ShopSwitcher({ current, shops }: { current: ShopLite; shops: ShopLite[] }) {
  const head = (
    <>
      <ShopLogo src={current.logoUrl} name={current.name} size={40} />
      <span className="flex min-w-0 flex-1 flex-col text-left">
        <span className="truncate text-sm font-semibold">{current.name}</span>
        <span className="flex items-center gap-1.5 text-xs text-muted capitalize">
          {current.role}
        </span>
      </span>
    </>
  );
  if (shops.length <= 1) {
    return (
      <div className="flex items-center gap-3 rounded-xl p-1">
        {head}
        <ShopStatusBadge status={current.status} />
      </div>
    );
  }
  return (
    <details className="group relative">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-xl p-1 hover:bg-surface-2 [&::-webkit-details-marker]:hidden" aria-label="Switch shop">
        {head}
        <ChevronsUpDown className="size-4 shrink-0 text-muted" aria-hidden />
      </summary>
      <div className="absolute inset-x-0 z-40 mt-1 rounded-xl border border-border bg-surface p-1.5 shadow-lg">
        <p className="px-2.5 py-1.5 text-xs font-medium text-muted">Your shops</p>
        {shops.map((s) => (
          <Link key={s.id} href={`/merchant/${s.id}`} className="flex min-h-11 items-center gap-2.5 rounded-lg px-2.5 text-sm hover:bg-surface-2">
            <ShopLogo src={s.logoUrl} name={s.name} size={28} />
            <span className="min-w-0 flex-1 truncate">{s.name}</span>
            {s.id === current.id && <Check className="size-4 text-primary" aria-label="Current shop" />}
          </Link>
        ))}
        <hr className="my-1 border-border" />
        <Link href="/merchant/new" className="flex min-h-11 items-center gap-2.5 rounded-lg px-2.5 text-sm hover:bg-surface-2">
          <Plus className="size-4 text-muted" aria-hidden /> Add another shop
        </Link>
      </div>
    </details>
  );
}
