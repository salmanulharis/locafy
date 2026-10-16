"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/primitives";

export default function AdminError({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error instanceof Error ? (error as Error & { digest?: string }).digest : undefined;
  return (
    <div className="mx-auto max-w-lg py-10">
      <Alert tone="danger" title="This admin page could not be loaded">
        Something went wrong while loading the data. No changes were made.
        {digest && <span className="mt-1 block text-xs">Reference: {digest}</span>}
      </Alert>
      <Button className="mt-4" onClick={() => retry()} icon={<RotateCcw className="size-4" aria-hidden />}>
        Try again
      </Button>
    </div>
  );
}
