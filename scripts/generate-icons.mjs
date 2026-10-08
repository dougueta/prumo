// Gera os ícones PWA com a geometria do <Logo> e as cores de src/styles/tokens.ts (spec 003,
// FR-006), renderizando um SVG no Chromium do Playwright. Uso: node scripts/generate-icons.mjs
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";
import { plumbGeometry } from "../src/components/brand/logo-geometry.ts";
import { BRAND_COLOR, BRAND_INK } from "../src/styles/tokens.ts";

// `padding` encolhe o desenho (maskable precisa de margem de segurança).
const svg = (size, padding) => {
  const { line, bob } = plumbGeometry(size, padding);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${BRAND_COLOR}"/>
  <line x1="${line.x1}" y1="${line.y1}" x2="${line.x2}" y2="${line.y2}" stroke="${BRAND_INK}" stroke-width="${line.strokeWidth}" stroke-linecap="round"/>
  <path d="${bob}" fill="${BRAND_INK}"/>
</svg>`;
};

const icons = [
  { file: "icon-192.png", size: 192, padding: 0.12 },
  { file: "icon-512.png", size: 512, padding: 0.12 },
  { file: "icon-maskable-512.png", size: 512, padding: 0.22 },
  { file: "apple-touch-icon.png", size: 180, padding: 0.14 },
];

mkdirSync("public/icons", { recursive: true });
const browser = await chromium.launch();
for (const { file, size, padding } of icons) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<html><body style="margin:0">${svg(size, padding)}</body></html>`);
  await page.screenshot({ path: `public/icons/${file}`, omitBackground: false });
  await page.close();
  console.log(`public/icons/${file}`);
}
await browser.close();
