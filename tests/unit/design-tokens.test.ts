import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import tokens from "@/design/tokens.json";
import { BRAND } from "@/lib/brand";

/** WCAG 2.x relative luminance contrast ratio for two hex colours. */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const palette = tokens.palette as Record<string, string>;
const semantic = tokens.semantic as Record<string, { value: string }>;
const hex = (name: string) => palette[semantic[name]!.value]!;

describe("design tokens", () => {
  const css = readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");
  const root = css.slice(css.indexOf(":root {"), css.indexOf("}", css.indexOf(":root {")));

  it("every semantic token resolves to a palette colour", () => {
    for (const [name, t] of Object.entries(semantic)) {
      expect(palette[t.value], `${name} → ${t.value}`).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it("globals.css :root mirrors tokens.json exactly", () => {
    for (const name of Object.keys(semantic)) {
      expect(root, `--${name}`).toContain(`--${name}: ${hex(name)};`);
    }
  });

  it("uses the specified Blue + Slate brand values", () => {
    expect(hex("primary")).toBe("#2563EB");
    expect(hex("primary-hover")).toBe("#1D4ED8");
    expect(hex("fg-strong")).toBe("#0F172A");
    expect(hex("fg")).toBe("#334155");
    expect(hex("fg-muted")).toBe("#64748B");
    expect(hex("bg")).toBe("#F8FAFC");
    expect(hex("surface")).toBe("#FFFFFF");
    expect(hex("border")).toBe("#E2E8F0");
    expect(hex("primary-soft")).toBe("#EFF6FF");
    expect(hex("accent")).toBe("#F59E0B");
    expect(hex("success")).toBe("#15803D");
    expect(hex("warning")).toBe("#B45309");
    expect(hex("danger")).toBe("#B91C1C");
    expect(BRAND.primary).toBe("#2563EB");
  });

  // Text pairs actually used in the UI must meet WCAG AA (4.5:1 for normal text).
  const TEXT_PAIRS: [string, string][] = [
    ["primary-fg", "primary"],
    ["primary-fg", "primary-hover"],
    ["primary", "surface"],
    ["primary", "bg"],
    ["primary-soft-fg", "primary-soft"],
    ["fg-strong", "bg"],
    ["fg", "surface"],
    ["fg", "surface-2"],
    ["fg-muted", "surface"],
    ["fg-muted", "bg"],
    ["accent-fg", "accent"],
    ["accent-soft-fg", "accent-soft"],
    ["accent-soft-fg", "surface"],
    ["success-soft-fg", "success-soft"],
    ["success", "surface"],
    ["warning-soft-fg", "warning-soft"],
    ["danger-soft-fg", "danger-soft"],
    ["danger", "surface"],
    ["primary-fg", "danger"],
    ["primary-fg", "danger-hover"],
    ["info-soft-fg", "info-soft"],
  ];
  it.each(TEXT_PAIRS)("%s on %s meets AA 4.5:1", (fg, bg) => {
    expect(contrast(hex(fg), hex(bg))).toBeGreaterThanOrEqual(4.5);
  });

  it("focus ring meets 3:1 non-text contrast on surfaces", () => {
    expect(contrast(hex("ring"), hex("surface"))).toBeGreaterThanOrEqual(3);
    expect(contrast(hex("ring"), hex("bg"))).toBeGreaterThanOrEqual(3);
  });
});
