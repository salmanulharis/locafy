import { Star } from "lucide-react";
import { cn } from "@/lib/cn";

export function RatingSummary({ average, count, className }: { average: number | null; count: number; className?: string }) {
  if (!count || average == null) return <span className={cn("text-xs text-muted", className)}>No reviews yet</span>;
  return (
    <span className={cn("inline-flex items-center gap-1 text-sm", className)}>
      <Star className="size-4 fill-accent text-accent" aria-hidden />
      <span className="font-medium tabular">{average.toFixed(1)}</span>
      <span className="text-muted">
        ({count} review{count === 1 ? "" : "s"})
      </span>
      <span className="sr-only">Rated {average.toFixed(1)} out of 5</span>
    </span>
  );
}

export function Stars({ value, size = "sm" }: { value: number; size?: "sm" | "md" }) {
  return (
    <span className="inline-flex" aria-label={`${value} out of 5 stars`} role="img">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          aria-hidden
          className={cn(size === "sm" ? "size-4" : "size-5", i <= value ? "fill-accent text-accent" : "text-border-strong")}
        />
      ))}
    </span>
  );
}
