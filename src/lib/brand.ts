import tokens from "@/design/tokens.json";

type PaletteKey = keyof typeof tokens.palette;
const resolve = (name: keyof typeof tokens.semantic) => tokens.palette[tokens.semantic[name].value as PaletteKey];

/**
 * Brand colours as plain hex for places that cannot read CSS variables
 * (map markers, browser theme-color, the web app manifest). Derived from the
 * platform-independent tokens in src/design/tokens.json.
 */
export const BRAND = {
  primary: resolve("primary"),
  background: resolve("bg"),
  muted: resolve("fg-muted"),
} as const;
