// Gera os ícones PWA provisórios (a identidade definitiva é da feature 003) renderizando um SVG
// no Chromium do Playwright. Uso: node scripts/generate-icons.mjs  → public/icons/*.png
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const BRAND = "#0f4c5c"; // verde-petróleo (direção aprovada na spec 003, Q1 = A)
const INK = "#f4efe6"; // neutro quente

// Prumo (fio de prumo): fio vertical + peso em gota. `padding` encolhe o desenho (maskable).
const svg = (size, padding) => {
  const s = size * (1 - padding * 2);
  const o = size * padding;
  const cx = size / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${BRAND}"/>
  <line x1="${cx}" y1="${o + s * 0.14}" x2="${cx}" y2="${o + s * 0.52}" stroke="${INK}" stroke-width="${s * 0.05}" stroke-linecap="round"/>
  <path d="M ${cx} ${o + s * 0.5} L ${cx + s * 0.17} ${o + s * 0.7} A ${s * 0.17} ${s * 0.17} 0 1 1 ${cx - s * 0.17} ${o + s * 0.7} Z" fill="${INK}"/>
</svg>`;
};

const icons = [
  { file: "icon-192.png", size: 192, padding: 0.08 },
  { file: "icon-512.png", size: 512, padding: 0.08 },
  { file: "icon-maskable-512.png", size: 512, padding: 0.2 },
  { file: "apple-touch-icon.png", size: 180, padding: 0.1 },
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
