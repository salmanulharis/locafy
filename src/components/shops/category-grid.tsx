import Link from "next/link";
import {
  Baby, BookOpen, Car, CookingPot, Dumbbell, Footprints, LayoutGrid, PawPrint, Pill, Refrigerator, Shirt, ShoppingBasket, Smartphone, Sparkles, Tv, Wrench,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  smartphone: Smartphone, tv: Tv, refrigerator: Refrigerator, "shopping-basket": ShoppingBasket, pill: Pill, wrench: Wrench,
  "book-open": BookOpen, shirt: Shirt, footprints: Footprints, "cooking-pot": CookingPot, sparkles: Sparkles, dumbbell: Dumbbell,
  baby: Baby, car: Car, "paw-print": PawPrint,
};

export function CategoryIcon({ name, className = "size-5" }: { name: string | null; className?: string }) {
  const Icon = (name && ICONS[name]) || LayoutGrid;
  return <Icon className={className} aria-hidden />;
}

export function CategoryGrid({ categories, limit }: { categories: { slug: string; name: string; icon: string | null }[]; limit?: number }) {
  const list = limit ? categories.slice(0, limit) : categories;
  return (
    <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
      {list.map((c) => (
        <li key={c.slug}>
          <Link
            href={`/search?category=${c.slug}`}
            className="flex h-full flex-col items-center gap-2 rounded-xl p-2 text-center text-xs font-medium text-fg hover:bg-surface-2 sm:text-sm"
          >
            <span className="flex size-12 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-fg">
              <CategoryIcon name={c.icon} className="size-5" />
            </span>
            <span className="line-clamp-2 leading-tight">{c.name}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
