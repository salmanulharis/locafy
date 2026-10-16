import { describe, expect, it } from "vitest";
import {
  applyQuantityChange,
  availabilityScore,
  deriveStockStatus,
  FRESH_WITHIN_DAYS,
  STALE_AFTER_DAYS,
  stockFreshness,
  type Freshness,
  type StockStatus,
} from "@/modules/inventory/rules";

const DAY = 86_400_000;

describe("deriveStockStatus", () => {
  it("keeps the explicit status when quantity is not tracked", () => {
    expect(deriveStockStatus(null, 3)).toBe("unknown");
    expect(deriveStockStatus(null, 3, "in_stock")).toBe("in_stock");
    expect(deriveStockStatus(null, 3, "out_of_stock")).toBe("out_of_stock");
  });

  it("derives from quantity and threshold", () => {
    expect(deriveStockStatus(0, 3)).toBe("out_of_stock");
    expect(deriveStockStatus(-2, 3)).toBe("out_of_stock");
    expect(deriveStockStatus(1, 3)).toBe("low_stock");
    expect(deriveStockStatus(3, 3)).toBe("low_stock");
    expect(deriveStockStatus(4, 3)).toBe("in_stock");
    expect(deriveStockStatus(1, 0)).toBe("in_stock");
  });

  it("quantity wins over a stale explicit status", () => {
    expect(deriveStockStatus(10, 3, "out_of_stock")).toBe("in_stock");
    expect(deriveStockStatus(0, 3, "in_stock")).toBe("out_of_stock");
  });
});

describe("applyQuantityChange", () => {
  it("set and adjust", () => {
    expect(applyQuantityChange(10, { mode: "set", value: 5 })).toBe(5);
    expect(applyQuantityChange(10, { mode: "adjust", delta: -1 })).toBe(9);
    expect(applyQuantityChange(10, { mode: "adjust", delta: -10 })).toBe(0);
    expect(applyQuantityChange(null, { mode: "adjust", delta: 3 })).toBe(3);
    expect(applyQuantityChange(null, { mode: "set", value: 0 })).toBe(0);
  });

  it("rejects negative results", () => {
    expect(() => applyQuantityChange(10, { mode: "adjust", delta: -11 })).toThrow(/below zero/);
    expect(() => applyQuantityChange(null, { mode: "adjust", delta: -1 })).toThrow(RangeError);
    expect(() => applyQuantityChange(5, { mode: "set", value: -1 })).toThrow(RangeError);
  });

  it("rejects fractional and non-finite quantities", () => {
    expect(() => applyQuantityChange(5, { mode: "set", value: 1.5 })).toThrow(/whole number/);
    expect(() => applyQuantityChange(5, { mode: "adjust", delta: 0.5 })).toThrow(/whole number/);
    expect(() => applyQuantityChange(5, { mode: "set", value: Number.NaN })).toThrow(RangeError);
    expect(() => applyQuantityChange(5, { mode: "set", value: Number.POSITIVE_INFINITY })).toThrow(RangeError);
  });

  it("rejects unrealistically large quantities", () => {
    expect(applyQuantityChange(0, { mode: "set", value: 1_000_000 })).toBe(1_000_000);
    expect(() => applyQuantityChange(0, { mode: "set", value: 1_000_001 })).toThrow(/large/);
    expect(() => applyQuantityChange(999_999, { mode: "adjust", delta: 2 })).toThrow(/large/);
    expect(() => applyQuantityChange(0, { mode: "set", value: Number.MAX_SAFE_INTEGER })).toThrow(RangeError);
  });
});

describe("stockFreshness", () => {
  const now = new Date("2026-06-15T12:00:00Z");
  const ago = (ms: number) => new Date(now.getTime() - ms);

  it("fresh within the window (inclusive)", () => {
    expect(stockFreshness(now, now)).toBe("fresh");
    expect(stockFreshness(ago(FRESH_WITHIN_DAYS * DAY), now)).toBe("fresh");
  });

  it("recent until stale threshold (inclusive)", () => {
    expect(stockFreshness(ago(FRESH_WITHIN_DAYS * DAY + 1), now)).toBe("recent");
    expect(stockFreshness(ago(STALE_AFTER_DAYS * DAY), now)).toBe("recent");
  });

  it("stale afterwards", () => {
    expect(stockFreshness(ago(STALE_AFTER_DAYS * DAY + 1), now)).toBe("stale");
    expect(stockFreshness(ago(365 * DAY), now)).toBe("stale");
  });

  it("treats clock-skewed future timestamps as fresh", () => {
    expect(stockFreshness(new Date(now.getTime() + DAY), now)).toBe("fresh");
  });
});

describe("availabilityScore", () => {
  it("scores", () => {
    expect(availabilityScore("in_stock", "fresh")).toBe(1);
    expect(availabilityScore("low_stock", "recent")).toBeCloseTo(0.68);
    expect(availabilityScore("unknown", "stale")).toBeCloseTo(0.175);
    expect(availabilityScore("out_of_stock", "fresh")).toBe(0);
  });

  it("is monotonic in status and freshness", () => {
    const statuses: StockStatus[] = ["in_stock", "low_stock", "unknown", "out_of_stock"];
    const fresh: Freshness[] = ["fresh", "recent", "stale"];
    for (const f of fresh) {
      const scores = statuses.map((s) => availabilityScore(s, f));
      expect([...scores].sort((a, b) => b - a)).toEqual(scores);
    }
    for (const s of statuses) {
      const scores = fresh.map((f) => availabilityScore(s, f));
      expect([...scores].sort((a, b) => b - a)).toEqual(scores);
    }
  });
});
