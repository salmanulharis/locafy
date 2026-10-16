import Link from "next/link";
import { Heart, Store } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { LocationPicker } from "@/components/maps/location-picker";
import { HeaderSearch } from "@/components/search/header-search";
import type { SelectedLocation } from "@/lib/location";
import type { SessionUser } from "@/modules/auth/sessions";
import { Logo } from "./logo";
import { UserMenu } from "./user-menu";

export function SiteHeader({ user, location, unread, showSearch = true }: { user: SessionUser | null; location: SelectedLocation | null; unread: number; showSearch?: boolean }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        <Logo />
        <div className="hidden min-w-0 sm:block">
          <LocationPicker current={location} />
        </div>
        {showSearch && (
          <div className="mx-2 hidden max-w-xl flex-1 md:block">
            <HeaderSearch />
          </div>
        )}
        <nav aria-label="Account" className="ml-auto flex items-center gap-1">
          <Link href="/merchant" className="hidden h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-muted hover:bg-surface-2 hover:text-fg lg:inline-flex">
            <Store className="size-4" aria-hidden /> For shops
          </Link>
          {user ? (
            <>
              <Link href="/saved" className="hidden size-10 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-fg md:inline-flex" aria-label="Saved items">
                <Heart className="size-5" />
              </Link>
              <UserMenu user={user} unread={unread} />
            </>
          ) : (
            <>
              <LinkButton href="/login" variant="ghost" size="sm">
                Sign in
              </LinkButton>
              <LinkButton href="/register" size="sm" className="hidden sm:inline-flex">
                Create account
              </LinkButton>
            </>
          )}
        </nav>
      </div>
      <div className="flex items-center gap-2 px-4 pb-3 sm:hidden">
        <LocationPicker current={location} className="max-w-full" />
      </div>
    </header>
  );
}
