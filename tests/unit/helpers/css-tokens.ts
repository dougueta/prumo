import { readFileSync } from "node:fs";
import path from "node:path";

/** Leitura de src/styles/tokens.css para os testes de contrato de tokens (spec 003). */
export const TOKENS_CSS_PATH = path.resolve(__dirname, "../../../src/styles/tokens.css");

export function readTokensCss(): string {
  return readFileSync(TOKENS_CSS_PATH, "utf8");
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Corpo (sem as chaves) do primeiro bloco cujo seletor é `selector` (espaços flexíveis). */
export function extractBlock(css: string, selector: string): string {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const pattern = selector.trim().split(/\s+/).map(escapeRegex).join("\\s*");
  // O seletor precisa começar uma regra: início do arquivo ou depois de "{", "}" ou ";".
  const match = new RegExp(`(?:^|[{};])\\s*${pattern}\\s*\\{`).exec(clean);
  if (!match) throw new Error(`Bloco não encontrado em tokens.css: ${selector}`);
  const start = match.index + match[0].length;
  let depth = 1;
  let j = start;
  while (j < clean.length && depth > 0) {
    if (clean[j] === "{") depth++;
    if (clean[j] === "}") depth--;
    j++;
  }
  return clean.slice(start, j - 1);
}

/** Declarações `--nome: valor;` de primeiro nível de um bloco. */
export function parseVars(block: string): Record<string, string> {
  const vars: Record<string, string> = {};
  let depth = 0;
  let top = "";
  for (const ch of block) {
    if (ch === "{") depth++;
    if (depth === 0) top += ch;
    if (ch === "}") depth--;
  }
  for (const match of top.matchAll(/(--[\w-]+)\s*:\s*([^;{}]+);/g)) {
    vars[match[1]] = match[2].trim();
  }
  return vars;
}

export const LIGHT_SELECTOR = ':root, [data-theme="light"]';
export const DARK_SELECTOR = '[data-theme="dark"]';
export const DARK_MEDIA_SELECTOR = ':root:not([data-theme="light"])';

export function themeVars(): { light: Record<string, string>; dark: Record<string, string> } {
  const css = readTokensCss();
  return {
    light: parseVars(extractBlock(css, LIGHT_SELECTOR)),
    dark: parseVars(extractBlock(css, DARK_SELECTOR)),
  };
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(h)) throw new Error(`Cor inválida: ${hex}`);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(channel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Razão de contraste WCAG 2.1. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Matiz (0–360) e saturação/luminosidade HSL (0–1). */
export function hsl(hex: string): { h: number; s: number; l: number } {
  const [r, g, b] = hexToRgb(hex).map((c) => c / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s, l };
}
