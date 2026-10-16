"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { setFavouriteAction } from "@/app/(public)/actions";
import { useToast } from "@/components/feedback/toaster";
import { cn } from "@/lib/cn";

/**
 * Save/unsave with optimistic UI. The backend result is authoritative: on
 * failure the optimistic state reverts and the error is announced.
 */
export function FavouriteButton({ kind, id, saved, signedIn, label, className }: { kind: "product" | "shop"; id: string; saved: boolean; signedIn: boolean; label: string; className?: string }) {
  const [optimistic, setOptimistic] = useOptimistic(saved);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  function toggle() {
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    const next = !optimistic;
    start(async () => {
      setOptimistic(next);
      const res = await setFavouriteAction(kind, id, next);
      if (!res.ok) toast({ tone: "error", message: res.message ?? "Couldn't update saved items." });
      else toast({ tone: "success", message: next ? `Saved ${label}` : `Removed ${label} from saved` });
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={optimistic}
      className={cn("inline-flex h-11 items-center gap-2 rounded-lg border border-border-strong bg-surface px-3.5 text-sm font-medium hover:bg-surface-2 disabled:opacity-70", className)}
    >
      <Heart className={cn("size-5", optimistic ? "fill-danger text-danger" : "text-muted")} aria-hidden />
      {optimistic ? "Saved" : "Save"}
    </button>
  );
}
