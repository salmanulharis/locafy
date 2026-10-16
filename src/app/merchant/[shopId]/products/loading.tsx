import { Skeleton } from "@/components/ui/primitives";

export default function ProductsLoading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading products">
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-11 w-32 rounded-lg" />
      </div>
      <Skeleton className="h-11 w-full rounded-lg" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
