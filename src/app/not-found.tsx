import { SearchX } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { Logo } from "@/components/layout/logo";

export default function NotFound() {
  return (
    <main id="main" className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <Logo />
      <span className="mt-6 flex size-12 items-center justify-center rounded-full bg-surface-2 text-muted">
        <SearchX className="size-6" aria-hidden />
      </span>
      <h1 className="text-title font-semibold">We couldn&apos;t find that page</h1>
      <p className="text-sm text-muted">The link may be broken, or the product or shop is no longer listed on Locafy.</p>
      <div className="flex gap-2">
        <LinkButton href="/">Go home</LinkButton>
        <LinkButton href="/search" variant="outline">
          Search products
        </LinkButton>
      </div>
    </main>
  );
}
