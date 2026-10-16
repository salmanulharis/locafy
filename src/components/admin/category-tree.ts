export type CategoryLike = { id: string; name: string; parentId: string | null; sortOrder: number };

export type CategoryNode<T extends CategoryLike> = T & { depth: number; path: string };

/** Flatten categories into depth-first order with depth and a "Parent › Child" path. */
export function flattenCategories<T extends CategoryLike>(rows: T[]): CategoryNode<T>[] {
  const byParent = new Map<string | null, T[]>();
  const ids = new Set(rows.map((r) => r.id));
  for (const r of rows) {
    const key = r.parentId && ids.has(r.parentId) ? r.parentId : null;
    byParent.set(key, [...(byParent.get(key) ?? []), r]);
  }
  const out: CategoryNode<T>[] = [];
  const seen = new Set<string>();
  const walk = (parent: string | null, depth: number, prefix: string) => {
    const children = (byParent.get(parent) ?? []).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    for (const c of children) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      const path = prefix ? `${prefix} › ${c.name}` : c.name;
      out.push({ ...c, depth, path });
      walk(c.id, depth + 1, path);
    }
  };
  walk(null, 0, "");
  return out;
}

export function categoryOptions<T extends CategoryLike>(rows: T[]) {
  return flattenCategories(rows).map((c) => ({ value: c.id, label: c.path }));
}
