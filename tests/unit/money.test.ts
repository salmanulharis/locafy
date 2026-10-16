import { describe, expect, it } from "vitest";
import { formatMoney, percentOff, toMajorInput } from "@/lib/money";
import { AppError } from "@/lib/errors";
import { formDataToObject, moneySchema, parseInput } from "@/lib/validation";

describe("moneySchema (major-unit input -> minor units)", () => {
  it.each([
    ["1499", 149_900],
    ["1,499.50", 149_950],
    ["0.5", 50],
    ["0.05", 5],
    ["10.1", 1_010],
    [" 1 499 ", 149_900],
    ["1,00,000", 10_000_000],
    ["0", 0],
    ["20000000", 2_000_000_000],
  ])("parses %j as %d", (input, expected) => {
    expect(moneySchema.parse(input)).toBe(expected);
  });

  it("accepts numbers", () => {
    expect(moneySchema.parse(1499)).toBe(149_900);
    expect(moneySchema.parse(12.5)).toBe(1_250);
  });

  it.each(["12.345", "-1", "-0.50", "abc", "", ".5", "1.", "1e3", "12..5", "1.2.3", "Rs 100", "₹100", "NaN", "Infinity"])(
    "rejects %j",
    (input) => {
      expect(moneySchema.safeParse(input).success).toBe(false);
    },
  );

  it("rejects numbers that are negative, non-finite or have more than 2 decimals", () => {
    expect(moneySchema.safeParse(-5).success).toBe(false);
    expect(moneySchema.safeParse(0.1 + 0.2).success).toBe(false);
    expect(moneySchema.safeParse(1e21).success).toBe(false);
    expect(moneySchema.safeParse(Number.NaN).success).toBe(false);
  });

  it("rejects amounts that are too large", () => {
    const r = moneySchema.safeParse("20000000.01");
    expect(r.success).toBe(false);
    expect(moneySchema.safeParse("99999999999999999999").success).toBe(false);
    const huge = moneySchema.safeParse("123456789012");
    expect(huge.success).toBe(false);
    if (!huge.success) expect(huge.error.issues[0]!.message).toMatch(/too large/i);
  });

  it("parseInput surfaces field errors keyed by path", () => {
    try {
      parseInput(moneySchema, "12.345");
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).code).toBe("VALIDATION_ERROR");
      expect((e as AppError).fieldErrors?._form?.[0]).toMatch(/2 decimals/);
    }
  });
});

describe("money helpers", () => {
  it("toMajorInput", () => {
    expect(toMajorInput(149_950)).toBe("1499.50");
    expect(toMajorInput(149_900)).toBe("1499");
    expect(toMajorInput(5)).toBe("0.05");
    expect(toMajorInput(null)).toBe("");
    expect(toMajorInput(undefined)).toBe("");
  });

  it("toMajorInput round-trips through moneySchema", () => {
    for (const minor of [1, 5, 99, 100, 149_950, 2_000_000_000]) {
      expect(moneySchema.parse(toMajorInput(minor))).toBe(minor);
    }
  });

  it("formatMoney uses Indian grouping and hides .00", () => {
    expect(formatMoney(149_950)).toBe("₹1,499.50");
    expect(formatMoney(10_000_000)).toBe("₹1,00,000");
  });

  it("percentOff", () => {
    expect(percentOff(900, 1000)).toBe(10);
    expect(percentOff(1000, 1000)).toBe(0);
    expect(percentOff(1100, 1000)).toBe(0);
    expect(percentOff(500, 0)).toBe(0);
    expect(percentOff(1099, 4490)).toBe(76);
  });
});

describe("formDataToObject", () => {
  it("turns name[] keys into arrays and blanks into undefined", () => {
    const fd = new FormData();
    fd.append("title", "  ");
    fd.append("tags[]", "a");
    fd.append("tags[]", "");
    fd.append("tags[]", "b");
    fd.append("$ACTION_ID_x", "ignored");
    fd.append("name", "Shop");
    expect(formDataToObject(fd)).toEqual({ title: undefined, tags: ["a", "b"], name: "Shop" });
  });
});
