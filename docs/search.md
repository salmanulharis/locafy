# Search and ranking

Implementation: `src/modules/search/service.ts` (SQL) and `src/modules/search/query.ts` (pure, unit-tested).

## Indexed text

`catalog_products.search_text` is maintained by the catalogue service (`refreshSearchText`) from name, brand + brand aliases, model, variant, product aliases, category and parent category names, and short spec values. `search_vector` is a stored generated `tsvector` (English config) with a GIN index; `search_text` also has a trigram GIN index.

## Staged matching (`resolveMatch`)

1. **exact** — every query word must match (`&`); each word may be satisfied by a configured synonym (`search_synonyms`, admin-editable); the last word is a prefix (`samsu` → `samsung`).
2. **partial** — for multi-word queries with no exact match, any word may match (`|`), ranked by coverage. The UI says "showing results that match some of your words".
3. **fuzzy** — `word_similarity(q, search_text) ≥ 0.5` (spelling tolerance, e.g. `samsng`). The UI says "showing similar spellings".

The first stage that finds catalogue products wins. Matching is location-independent; location filters apply afterwards so we can tell the user when a product exists **outside** their radius.

## Candidates

One row per published listing at an active shop, choosing the best branch: nearest branch within the radius when a location is set (otherwise cheapest). Branches without coordinates are excluded. Active offers are applied in SQL with the same rules as `applyDiscount` (never above the original price, never below 1).

## Ranking ("Best match")

```
score = 0.55·relevance + 0.25·availability + 0.15·proximity + 0.05·shop rating
availability = stock (in 1, low 0.8, unknown 0.35, out 0) × freshness (≤3 d 1, ≤14 d 0.85, older 0.5)
proximity    = 1 / (1 + distance_m / 3000)   (0.5 when no location)
```

Other sorts: lowest effective price, nearest, best-rated shop. Variants are distinct catalogue products and are never merged.

## Sponsored results

At most one sponsored listing on page 1, only if it matches the same query and filters, rendered separately with a "Sponsored" label. Organic ordering, prices and availability are unaffected.

## No results

If nothing matches nearby: `existsOutsideRadius` triggers a "search within 50 km" prompt, and up to 8 **alternatives** from related categories are shown under "Similar products nearby — not exact matches".

## Observability

Every search writes `search_logs` (query, result count, duration, had location). The admin overview shows 7-day volume, zero-result rate and p95 latency; top and zero-result queries guide synonym tuning.

## Performance

Measured locally on demo data: 10–60 ms per search. Target: p95 < 1 s under the agreed pilot workload — must be load-tested on production-like data before launch. Scaling path: materialise shop rating aggregates, cap candidate product ids, then consider Meilisearch/OpenSearch with outbox-based reconciliation (PostgreSQL remains the source of truth).
