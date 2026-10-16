"use client";

import { useEffect } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/primitives";

export default function MerchantError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const digest = (error as { digest?: string } | null)?.digest;
  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <Card>
        <EmptyState
          icon={<TriangleAlert className="size-5" />}
          title="This page couldn't be loaded"
          description={
            <>
              Something went wrong on our side. Your saved data is safe — try again in a moment.
              {digest && <span className="mt-2 block text-xs text-muted">Reference: {digest}</span>}
            </>
          }
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => retry()} icon={<RotateCcw className="size-4" aria-hidden />}>
                Try again
              </Button>
              <LinkButton href="/merchant" variant="outline">
                My shops
              </LinkButton>
            </div>
          }
        />
      </Card>
    </div>
  );
}
