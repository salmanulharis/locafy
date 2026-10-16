import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { login } from "@/modules/auth/service";
import { enforceRateLimit, RATE_RULES } from "@/modules/platform/rate-limit";
import { createUser, ctxOf, expectCode, PASSWORD, truncateAll } from "./helpers";

// This file exercises the real limiter, so the global bypass is lifted here only.
let previous: string | undefined;
beforeAll(() => {
  previous = process.env.DISABLE_RATE_LIMITS;
  delete process.env.DISABLE_RATE_LIMITS;
});
afterAll(() => {
  if (previous === undefined) delete process.env.DISABLE_RATE_LIMITS;
  else process.env.DISABLE_RATE_LIMITS = previous;
});
beforeEach(truncateAll);

describe("rate limiting", () => {
  it("exceeding the login rule -> RATE_LIMITED (even with the right password)", async () => {
    await createUser({ email: "rl@example.test" });
    const ctx = ctxOf(null, "203.0.113.7");
    const limit = RATE_RULES.login.limit;
    for (let i = 0; i < limit; i++) {
      await expectCode(login(ctx, { email: "rl@example.test", password: "wrong-pass-1" }), "VALIDATION_ERROR");
    }
    const e = await expectCode(login(ctx, { email: "rl@example.test", password: PASSWORD }), "RATE_LIMITED");
    expect(e.status).toBe(429);
    const retry = e.details?.retryAfterSeconds as number;
    expect(retry).toBeGreaterThan(0);
    expect(retry).toBeLessThanOrEqual(RATE_RULES.login.windowSeconds);

    // Other subjects (different IP or email) are unaffected.
    await login(ctxOf(null, "203.0.113.8"), { email: "rl@example.test", password: PASSWORD });
  });

  it("counters reset after the window", async () => {
    for (let i = 0; i < RATE_RULES.geocode.limit; i++) await enforceRateLimit("geocode", "subject-1");
    await expectCode(enforceRateLimit("geocode", "subject-1"), "RATE_LIMITED");
    const { getSql } = await import("@/db/client");
    await getSql()`update rate_limits set window_start = now() - interval '2 minutes' where key = 'geocode:subject-1'`;
    await enforceRateLimit("geocode", "subject-1");
  });

  it("concurrent requests cannot slip past the limit", async () => {
    const results = await Promise.allSettled(Array.from({ length: 40 }, () => enforceRateLimit("geocode", "burst")));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(RATE_RULES.geocode.limit);
  });
});
