"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Mobile bottom sheet that hosts the server-rendered filter form. */
export function FilterSheet({ children, activeCount }: { children: ReactNode; activeCount: number }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (open && !ref.current?.open) ref.current?.showModal();
    if (!open && ref.current?.open) ref.current.close();
  }, [open]);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} icon={<SlidersHorizontal className="size-4" aria-hidden />}>
        Filters{activeCount ? ` (${activeCount})` : ""}
      </Button>
      <dialog
        ref={ref}
        onClose={() => setOpen(false)}
        onClick={(e) => e.target === ref.current && setOpen(false)}
        aria-label="Filters"
        className="m-0 mt-auto max-h-[100dvh] w-full max-w-none bg-transparent p-0"
      >
        <div className="flex max-h-[88dvh] flex-col rounded-t-2xl bg-surface pb-safe">
          <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
            <h2 className="text-heading font-semibold">Filters</h2>
            <button type="button" onClick={() => setOpen(false)} className="-m-2 rounded-lg p-2 text-muted" aria-label="Close filters">
              <X className="size-5" />
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-4" onSubmit={() => setOpen(false)}>
            {children}
          </div>
        </div>
      </dialog>
    </>
  );
}
