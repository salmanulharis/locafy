import Link from "next/link";
import { Logo } from "./logo";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border bg-surface pb-24 md:pb-0">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-[1.5fr_1fr_1fr]">
        <div className="flex flex-col gap-3">
          <Logo />
          <p className="max-w-xs text-sm text-muted">Find what you need. Compare nearby options. Know what is available. Find the shop.</p>
        </div>
        <div>
          <h2 className="text-sm font-semibold">Discover</h2>
          <ul className="mt-3 flex flex-col gap-2 text-sm text-muted">
            <li><Link href="/search" className="hover:text-fg">Search products</Link></li>
            <li><Link href="/shops" className="hover:text-fg">Shops near you</Link></li>
            <li><Link href="/offers" className="hover:text-fg">Local offers</Link></li>
            <li><Link href="/categories" className="hover:text-fg">Categories</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-semibold">For shops</h2>
          <ul className="mt-3 flex flex-col gap-2 text-sm text-muted">
            <li><Link href="/merchant" className="hover:text-fg">List your shop</Link></li>
            <li><Link href="/pricing" className="hover:text-fg">Plans</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <p className="mx-auto max-w-6xl px-4 py-4 text-xs text-muted">
          Stock and prices are provided by shops and may change. Check with the shop before travelling.
        </p>
      </div>
    </footer>
  );
}
