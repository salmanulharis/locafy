import { describe, expect, it } from "vitest";
import { normalizeKey, slugify, uniqueSlug } from "@/lib/text";
import { directionsUrl, formatDistance, haversineMetres } from "@/modules/geo/format";
import { sniffImageType } from "@/modules/media/service";
import { looksLikeSpam } from "@/modules/enquiries/service";
import { canEditReview, REVIEW_EDIT_WINDOW_DAYS } from "@/modules/reviews/service";
import { publicName } from "@/modules/products/service";

const DAY = 86_400_000;

describe("slugify", () => {
  it.each([
    ["Hello World", "hello-world"],
    ["Café & Bar", "cafe-and-bar"],
    ["  --Foo__Bar--  ", "foo-bar"],
    ["Samsung Galaxy A55 5G (8GB/128GB)", "samsung-galaxy-a55-5g-8gb-128gb"],
    ["", ""],
    ["!!!", ""],
    ["मोबाइल", ""],
  ])("%j -> %j", (input, out) => {
    expect(slugify(input)).toBe(out);
  });

  it("caps at 60 chars without a trailing hyphen", () => {
    const s = slugify(`${"a".repeat(59)} bbbbbbbbbb`);
    expect(s).toBe("a".repeat(59));
    expect(slugify("word ".repeat(40)).length).toBeLessThanOrEqual(60);
    expect(slugify("word ".repeat(40))).not.toMatch(/-$/);
  });

  it("uniqueSlug adds a random suffix and falls back to 'item'", () => {
    expect(uniqueSlug("My Shop")).toMatch(/^my-shop-[0-9a-f]{6}$/);
    expect(uniqueSlug("!!!")).toMatch(/^item-[0-9a-f]{6}$/);
    expect(uniqueSlug("x")).not.toBe(uniqueSlug("x"));
  });

  it("normalizeKey", () => {
    expect(normalizeKey("  Hello,   WORLD!! ")).toBe("hello world");
    expect(normalizeKey(null)).toBe("");
  });
});

describe("haversineMetres", () => {
  const kochi = { lat: 9.9312, lng: 76.2673 };
  it("zero for the same point", () => {
    expect(haversineMetres(kochi, kochi)).toBe(0);
  });
  it("one degree of latitude is ~111.2 km", () => {
    expect(haversineMetres({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111_195, -1);
  });
  it("is symmetric and plausible for Kochi -> Edappally", () => {
    const edappally = { lat: 10.0261, lng: 76.3125 };
    const d = haversineMetres(kochi, edappally);
    expect(d).toBeGreaterThan(11_000);
    expect(d).toBeLessThan(12_500);
    expect(haversineMetres(edappally, kochi)).toBeCloseTo(d, 6);
  });
  it("antipodal points are half the circumference", () => {
    expect(haversineMetres({ lat: 0, lng: 0 }, { lat: 0, lng: 180 })).toBeCloseTo(Math.PI * 6_371_008.8, 0);
  });
});

describe("formatDistance", () => {
  it.each([
    [null, null],
    [undefined, null],
    [Number.NaN, null],
    [Number.POSITIVE_INFINITY, null],
    [0, "50 m"],
    [20, "50 m"],
    [149, "150 m"],
    [520, "500 m"],
    [999, "1.0 km"],
    [1000, "1.0 km"],
    [3_240, "3.2 km"],
    [10_000, "10 km"],
    [25_600, "26 km"],
  ] as const)("%s -> %s", (m, out) => {
    expect(formatDistance(m as number | null | undefined)).toBe(out);
  });

  it("never shows 1000 m", () => {
    for (let m = 900; m < 1100; m += 1) expect(formatDistance(m)).not.toBe("1000 m");
  });
});

describe("directionsUrl", () => {
  it("builds an external maps link", () => {
    expect(directionsUrl({ lat: 10, lng: 76 })).toBe("https://www.google.com/maps/dir/?api=1&destination=10%2C76");
    expect(directionsUrl({ lat: 10, lng: 76 }, { lat: 9, lng: 75 })).toContain("origin=9%2C75");
  });
});

describe("sniffImageType", () => {
  const pad = (b: number[]) => new Uint8Array([...b, ...new Array(16).fill(0)]);
  it("detects jpeg/png/webp from magic bytes", () => {
    expect(sniffImageType(pad([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpeg");
    expect(sniffImageType(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("png");
    expect(sniffImageType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50, 0, 0]))).toBe("webp");
  });
  it("rejects other content", () => {
    expect(sniffImageType(new TextEncoder().encode("hello, I am a text file pretending"))).toBeNull();
    expect(sniffImageType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x41, 0x56, 0x45]))).toBeNull(); // RIFF WAVE
    expect(sniffImageType(new TextEncoder().encode("GIF89a........"))).toBeNull();
    expect(sniffImageType(new TextEncoder().encode("<svg xmlns='x'/>"))).toBeNull();
  });
  it("rejects buffers shorter than 12 bytes", () => {
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff]))).toBeNull();
    expect(sniffImageType(new Uint8Array([]))).toBeNull();
  });
});

describe("looksLikeSpam", () => {
  it("flags more than two links", () => {
    expect(looksLikeSpam("see http://a.com http://b.com https://c.com")).toBe(true);
    expect(looksLikeSpam("HTTP://A HTTPS://B HtTp://C")).toBe(true);
    expect(looksLikeSpam("see http://a.com and https://b.com")).toBe(false);
  });
  it("flags long runs of a repeated character", () => {
    expect(looksLikeSpam("a".repeat(16))).toBe(true);
    expect(looksLikeSpam(`buy now${"!".repeat(20)}`)).toBe(true);
    expect(looksLikeSpam("a".repeat(15))).toBe(false);
  });
  it("normal messages pass", () => {
    expect(looksLikeSpam("Is the Galaxy A55 in blue available today? I can come by 5pm.")).toBe(false);
  });
});

describe("canEditReview", () => {
  const now = new Date("2026-06-15T12:00:00Z");
  it("editable within the window (inclusive)", () => {
    expect(canEditReview(now, now)).toBe(true);
    expect(canEditReview(new Date(now.getTime() - REVIEW_EDIT_WINDOW_DAYS * DAY), now)).toBe(true);
  });
  it("not editable after the window", () => {
    expect(canEditReview(new Date(now.getTime() - REVIEW_EDIT_WINDOW_DAYS * DAY - 1), now)).toBe(false);
  });
});

describe("publicName", () => {
  it.each([
    ["Priya Raman", "Priya R."],
    ["priya raman kumar", "priya K."],
    ["  Anil   kumar ", "Anil K."],
    ["Priya", "Priya"],
    ["", "Locafy user"],
    ["   ", "Locafy user"],
    [null, "Locafy user"],
    [undefined, "Locafy user"],
  ])("%j -> %j", (input, out) => {
    expect(publicName(input)).toBe(out);
  });
});
