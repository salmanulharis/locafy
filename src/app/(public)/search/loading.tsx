import { Skeleton } from "@/components/ui/primitives";

export default function SearchLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-5" aria-busy="true" aria-label="Loading results">
      <Skeleton className="mb-2 h-8 w-64" />
      <Skeleton className="mb-6 h-4 w-40" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-3 rounded-xl border border-border bg-surface p-3">
            <Skeleton className="size-24 shrink-0 rounded-lg" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-3 w-40" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
