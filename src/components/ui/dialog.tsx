"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

type DialogProps = {
  trigger: (open: () => void) => ReactNode;
  title: string;
  description?: ReactNode;
  children: (close: () => void) => ReactNode;
  /** "sheet" slides from the bottom on mobile and from the side on desktop. */
  variant?: "modal" | "sheet";
  className?: string;
};

/**
 * Accessible dialog built on the native <dialog> element (focus trapping,
 * Escape to close and inert background come from the platform).
 */
export function Dialog({ trigger, title, description, children, variant = "modal", className }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const [isOpen, setOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (isOpen && !el.open) el.showModal();
    if (!isOpen && el.open) el.close();
  }, [isOpen]);

  const close = () => setOpen(false);

  return (
    <>
      {trigger(() => setOpen(true))}
      <dialog
        ref={ref}
        aria-labelledby={titleId}
        onClose={close}
        onClick={(e) => {
          if (e.target === ref.current) close();
        }}
        className={cn(
          "m-0 max-h-[100dvh] w-full max-w-none bg-transparent p-0 text-fg backdrop:backdrop-blur-[1px]",
          variant === "modal" && "m-auto max-w-lg px-4",
          variant === "sheet" && "mt-auto md:mt-0 md:mr-0 md:ml-auto md:h-[100dvh] md:max-h-[100dvh] md:w-[26rem]",
        )}
      >
        {isOpen && (
          <div
            className={cn(
              "flex max-h-[90dvh] flex-col overflow-hidden bg-surface shadow-lg",
              variant === "modal" && "rounded-xl",
              variant === "sheet" && "rounded-t-2xl pb-safe md:h-full md:max-h-none md:rounded-none",
              className,
            )}
          >
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div>
                <h2 id={titleId} className="text-heading font-semibold">
                  {title}
                </h2>
                {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
              </div>
              <button type="button" onClick={close} className="-m-2 rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-fg" aria-label="Close">
                <X className="size-5" />
              </button>
            </div>
            <div className="overflow-y-auto px-5 py-4">{children(close)}</div>
          </div>
        )}
      </dialog>
    </>
  );
}
