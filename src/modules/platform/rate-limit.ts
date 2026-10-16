import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { errors } from "@/lib/errors";

export type RateRule = { limit: number; windowSeconds: number };

/** Central catalogue of rate limits so they are easy to review and tune. */
export const RATE_RULES = {
  login: { limit: 10, windowSeconds: 15 * 60 },
  register: { limit: 5, windowSeconds: 60 * 60 },
  passwordReset: { limit: 5, windowSeconds: 60 * 60 },
  enquiryCreate: { limit: 10, windowSeconds: 60 * 60 },
  enquiryMessage: { limit: 60, windowSeconds: 60 * 60 },
  reviewWrite: { limit: 10, windowSeconds: 60 * 60 },
  reportCreate: { limit: 20, windowSeconds: 60 * 60 },
  upload: { limit: 60, windowSeconds: 60 * 60 },
  geocode: { limit: 30, windowSeconds: 60 },
  search: { limit: 120, windowSeconds: 60 },
  event: { limit: 300, windowSeconds: 60 },
} satisfies Record<string, RateRule>;

function disabled() {
  return process.env.NODE_ENV !== "production" && process.env.DISABLE_RATE_LIMITS === "1";
}

/**
 * Fixed-window counter stored in Postgres (works across app instances without
 * Redis). Throws RATE_LIMITED when the limit is exceeded.
 */
export async function enforceRateLimit(name: keyof typeof RATE_RULES, subject: string | null | undefined) {
  if (disabled()) return;
  const rule = RATE_RULES[name];
  const key = `${name}:${subject ?? "anon"}`;
  const rows = await getDb().execute<{ count: number; window_start: Date }>(sql`
    insert into rate_limits (key, window_start, count)
    values (${key}, now(), 1)
    on conflict (key) do update set
      count = case when rate_limits.window_start < now() - make_interval(secs => ${rule.windowSeconds})
                   then 1 else rate_limits.count + 1 end,
      window_start = case when rate_limits.window_start < now() - make_interval(secs => ${rule.windowSeconds})
                   then now() else rate_limits.window_start end
    returning count, window_start
  `);
  const row = rows[0];
  if (row && row.count > rule.limit) {
    const elapsed = (Date.now() - new Date(row.window_start).getTime()) / 1000;
    throw errors.rateLimited(Math.max(1, Math.ceil(rule.windowSeconds - elapsed)));
  }
}
