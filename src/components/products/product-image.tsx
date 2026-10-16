import Image from "next/image";
import { Package } from "lucide-react";
import { cn } from "@/lib/cn";

/** Product/shop image with a neutral placeholder when no photo exists. */
export function ProductImage({ src, alt, className, sizes = "(min-width: 768px) 200px, 40vw", priority }: { src: string | null | undefined; alt: string; className?: string; sizes?: string; priority?: boolean }) {
  return (
    <div className={cn("relative overflow-hidden bg-surface-2", className)}>
      {src ? (
        <Image src={src} alt={alt} fill sizes={sizes} className="object-contain" priority={priority} />
      ) : (
        <div className="flex size-full items-center justify-center text-subtle" aria-label="No photo available" role="img">
          <Package className="size-1/3 max-h-10 max-w-10" aria-hidden />
        </div>
      )}
    </div>
  );
}
