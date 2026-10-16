"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Recoverable error state. Never shows internal details (only the digest for support). */
export default function PublicError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-20 text-center">
      <h1 className="text-title font-semibold">Something went wrong</h1>
      <p className="text-sm text-muted">We couldn&apos;t load this page. Check your connection and try again.</p>
      <Button onClick={reset} icon={<RotateCcw className="size-4" aria-hidden />}>
        Try again
      </Button>
      {error.digest && <p className="text-xs text-muted">Reference: {error.digest}</p>}
    </div>
  );
}
