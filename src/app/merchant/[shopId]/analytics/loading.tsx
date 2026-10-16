import { Skeleton } from "@/components/ui/primitives";

export default function AnalyticsLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading analytics">
      <Skeleton className="h-8 w-40" />
      <div className="flex gap-2">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-11 w-28 rounded-lg" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}
