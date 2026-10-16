import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "soft";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap transition-colors select-none disabled:pointer-events-none disabled:opacity-55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-fg hover:bg-primary-hover active:bg-primary-hover shadow-xs",
  secondary: "bg-surface-2 text-fg hover:bg-border",
  outline: "border border-border-strong bg-surface text-fg hover:bg-surface-2",
  ghost: "text-fg hover:bg-surface-2",
  danger: "bg-danger text-primary-fg hover:bg-danger-hover active:bg-danger-hover shadow-xs",
  soft: "bg-primary-soft text-primary-soft-fg hover:bg-primary-soft/70",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-sm",
  lg: "h-12 px-5 text-base",
  icon: "h-11 w-11",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

type ButtonProps = ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
};

export function Button({ variant, size, loading, icon, className, children, disabled, type = "button", ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClass(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}

type LinkButtonProps = ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize; icon?: ReactNode };

export function LinkButton({ variant, size, icon, className, children, ...rest }: LinkButtonProps) {
  return (
    <Link className={buttonClass(variant, size, className)} {...rest}>
      {icon}
      {children}
    </Link>
  );
}
