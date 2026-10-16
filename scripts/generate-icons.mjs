/**
 * Regenerate PWA / favicon PNGs from the logo mark.
 * Usage: pnpm icons   (colour comes from src/design/tokens.json)
 */
import { readFileSync } from "node:fs";
import sharp from "sharp";

const tokens = JSON.parse(readFileSync(new URL("../src/design/tokens.json", import.meta.url), "utf8"));
const PRIMARY = tokens.palette[tokens.semantic.primary.value];
const mark = (padded) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="${padded ? 0 : 9}" fill="${PRIMARY}"/>
  <g transform="${padded ? "translate(4.8 4.8) scale(0.7)" : ""}">
    <path d="M16 7.5c-3.9 0-7 3.03-7 6.78 0 4.9 7 10.22 7 10.22s7-5.32 7-10.22c0-3.75-3.1-6.78-7-6.78Z" fill="#fff"/>
    <circle cx="16" cy="14.3" r="2.6" fill="${PRIMARY}"/>
  </g></svg>`;

const outputs = [
  ["public/icons/icon-192.png", 192, false],
  ["public/icons/icon-512.png", 512, false],
  ["public/icons/maskable-512.png", 512, true], // full-bleed safe zone for maskable icons
  ["public/icons/apple-touch-icon.png", 180, true],
  ["src/app/icon.png", 48, false],
];
for (const [file, size, padded] of outputs) {
  await sharp(Buffer.from(mark(padded))).resize(size, size).png().toFile(file);
}
console.log(`Generated ${outputs.length} icons.`);
