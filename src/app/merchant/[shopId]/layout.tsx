import type { ReactNode } from "react";
import { MobileNav, SidebarNav, type NavItem } from "@/components/merchant/merchant-nav";
import { ShopSwitcher } from "@/components/merchant/shop-switcher";
import { roleAllows, type ShopPermission } from "@/modules/access/permissions";
import { openEnquiryCount } from "@/modules/enquiries/service";
import { listMyShops } from "@/modules/shops/service";
import { loadShop, merchantCtx } from "../_lib/data";

export default async function ShopLayout({ children, params }: { children: ReactNode; params: Promise<{ shopId: string }> }) {
  const { shopId } = await params;
  const ctx = await merchantCtx();
  // Pages redirect anonymous visitors to sign-in with their exact path.
  if (!ctx.actor) return <>{children}</>;

  const { shop, role } = await loadShop(shopId);
  const [shops, openCount] = await Promise.all([
    listMyShops(ctx),
    roleAllows(role, "enquiry.respond") ? openEnquiryCount(shopId) : Promise.resolve(0),
  ]);

  const base = `/merchant/${shopId}`;
  const all: (NavItem & { perm: ShopPermission })[] = [
    { key: "dashboard", href: base, label: "Dashboard", perm: "shop.view" },
    { key: "products", href: `${base}/products`, label: "Products", perm: "shop.view" },
    { key: "offers", href: `${base}/offers`, label: "Offers", perm: "offer.manage" },
    { key: "enquiries", href: `${base}/enquiries`, label: "Enquiries", perm: "enquiry.respond", count: openCount },
    { key: "reviews", href: `${base}/reviews`, label: "Reviews", perm: "shop.view" },
    { key: "analytics", href: `${base}/analytics`, label: "Analytics", perm: "analytics.view" },
    { key: "team", href: `${base}/team`, label: "Team", perm: "shop.view" },
    { key: "plan", href: `${base}/plan`, label: "Plan", perm: "subscription.view" },
    { key: "settings", href: `${base}/settings`, label: "Shop settings", perm: "shop.edit" },
  ];
  const items: NavItem[] = all.filter((i) => roleAllows(role, i.perm)).map((i) => ({ key: i.key, href: i.href, label: i.label, count: i.count }));
  const current = { id: shop.id, name: shop.name, status: shop.status, logoUrl: shop.logoUrl, role };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 md:flex-row md:gap-8 md:py-8">
      <aside className="md:w-60 md:shrink-0">
        <div className="flex flex-col gap-3 md:sticky md:top-24">
          <ShopSwitcher current={current} shops={shops} />
          <div className="hidden md:block">
            <SidebarNav items={items} />
          </div>
          <div className="md:hidden">
            <MobileNav items={items} shopName={shop.name} />
          </div>
        </div>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
