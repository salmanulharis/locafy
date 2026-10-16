import type { ComponentProps, ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/cn";

export function Card({ className, ...rest }: ComponentProps<"div">) {
  return <div className={cn("rounded-xl border border-border bg-surface", className)} {...rest} />;
}

export type Tone = "neutral" | "primary" | "success" | "warning" | "danger" | "info" | "accent" | "deal";

const toneClass: Record<Tone, string> = {
  neutral: "bg-surface-2 text-fg",
  primary: "bg-primary-soft text-primary-soft-fg",
  success: "bg-success-soft text-success-soft-fg",
  warning: "bg-warning-soft text-warning-soft-fg",
  danger: "bg-danger-soft text-danger-soft-fg",
  info: "bg-info-soft text-info-soft-fg",
  accent: "bg-accent-soft text-accent-soft-fg",
  deal: "bg-accent text-accent-fg",
};

export function Badge({ tone = "neutral", className, children, icon }: { tone?: Tone; className?: string; children: ReactNode; icon?: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap", toneClass[tone], className)}>
      {icon}
      {children}
    </span>
  );
}

const alertIcon: Record<"info" | "success" | "warning" | "danger", ReactNode> = {
  info: <Info className="size-5 shrink-0" aria-hidden />,
  success: <CheckCircle2 className="size-5 shrink-0" aria-hidden />,
  warning: <AlertTriangle className="size-5 shrink-0" aria-hidden />,
  danger: <XCircle className="size-5 shrink-0" aria-hidden />,
};

export function Alert({ tone = "info", title, children, className, action }: { tone?: "info" | "success" | "warning" | "danger"; title?: ReactNode; children?: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex gap-3 rounded-lg p-3.5 text-sm", toneClass[tone], className)}>
      {alertIcon[tone]}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="leading-relaxed">{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, description, action, className }: { icon?: ReactNode; title: string; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center gap-3 px-4 py-12 text-center", className)}>
      {icon && <div className="flex size-12 items-center justify-center rounded-full bg-surface-2 text-muted">{icon}</div>}
      <div className="max-w-sm">
        <h3 className="text-heading font-semibold">{title}</h3>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-surface-2", className)} />;
}

export function PageHeader({ title, description, actions, back }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; back?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back}
        <h1 className="text-title font-semibold tracking-tight text-balance">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatTile({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "warning" | "danger" }) {
  return (
    <Card className="flex flex-col gap-1 p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className={cn("text-2xl font-semibold text-strong tabular", tone === "warning" && "text-warning-soft-fg", tone === "danger" && "text-danger-soft-fg")}>{value}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </Card>
  );
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cn("border-border", className)} />;
}

export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className="sr-only">{children}</span>;
}
