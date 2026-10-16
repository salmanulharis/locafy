import type { ReactNode } from "react";

export function AuthCard({ title, description, children, footer }: { title: string; description?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-10 sm:py-16">
      <div>
        <h1 className="text-title font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-muted">{description}</p>}
      </div>
      <div className="rounded-xl border border-border bg-surface p-5 sm:p-6">{children}</div>
      {footer && <div className="text-center text-sm text-muted">{footer}</div>}
    </div>
  );
}
