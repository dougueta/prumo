import { describe, expect, it } from "vitest";
import {
  DARK_MEDIA_SELECTOR,
  contrast,
  extractBlock,
  hsl,
  parseVars,
  readTokensCss,
  themeVars,
} from "./helpers/css-tokens";

/**
 * FR-001/FR-002/FR-003/FR-019 — contraste AA calculado sobre src/styles/tokens.css
 * (research R-03, data-model §1.1–§1.3). Token novo de texto MUST entrar em TEXT_PAIRS.
 */
const TEXT_PAIRS: [string, string][] = [
  ["foreground", "background"],
  ["foreground", "surface"],
  ["foreground", "surface-muted"],
  ["foreground-muted", "background"],
  ["foreground-muted", "surface"],
  ["foreground-muted", "surface-muted"],
  ["primary", "background"],
  ["primary", "surface"],
  ["primary-foreground", "primary"],
  ["primary", "primary-subtle"],
  ["info", "surface"],
  ["info", "info-subtle"],
  ["income", "surface"],
  ["income", "background"],
  ["income", "income-subtle"],
  ["expense", "surface"],
  ["expense", "background"],
  ["expense", "expense-subtle"],
  ["warning", "surface"],
  ["warning", "warning-subtle"],
  ["danger", "surface"],
  ["danger", "danger-subtle"],
  ["danger-foreground", "danger"],
  ["ai", "surface"],
  ["ai", "ai-subtle"],
  ["demo-foreground", "demo"],
];

const GRAPHIC_PAIRS: [string, string][] = [
  ["focus", "background"],
  ["focus", "surface"],
  ["border-strong", "surface"],
  ["border-strong", "background"],
];

const CATEGORY_COLORS = [
  "petroleo",
  "azul",
  "verde",
  "oliva",
  "ambar",
  "terracota",
  "rosa",
  "violeta",
  "cinza",
] as const;

// data-model §1.1 — valores fixados (direção da paleta, FR-002).
const FIXED: Record<string, [light: string, dark: string]> = {
  background: ["#FAF8F5", "#141312"],
  surface: ["#FFFFFF", "#1D1B19"],
  "surface-muted": ["#F2EFEA", "#262320"],
  foreground: ["#1F2421", "#EEEAE4"],
  "foreground-muted": ["#5E5850", "#B3ACA2"],
  primary: ["#0F4C5C", "#6CBACB"],
  income: ["#2B7249", "#7DC79C"],
  expense: ["#A14A2B", "#E59C7E"],
  danger: ["#B42318", "#F28B82"],
};

const themes = themeVars();

function color(theme: "light" | "dark", token: string): string {
  const value = themes[theme][`--${token}`];
  if (!value) throw new Error(`Token --${token} ausente no tema ${theme}`);
  return value;
}

describe.each(["light", "dark"] as const)("tokens do tema %s", (theme) => {
  it("pares de texto atingem 4,5:1 (WCAG AA)", () => {
    const failures = TEXT_PAIRS.map(([fg, bg]) => [
      fg,
      bg,
      contrast(color(theme, fg), color(theme, bg)),
    ])
      .filter(([, , ratio]) => (ratio as number) < 4.5)
      .map(([fg, bg, ratio]) => `${fg}/${bg} = ${(ratio as number).toFixed(2)}`);
    expect(failures).toEqual([]);
  });

  it("foco e bordas de controles atingem 3:1 (WCAG 1.4.11)", () => {
    const failures = GRAPHIC_PAIRS.map(([fg, bg]) => [
      fg,
      bg,
      contrast(color(theme, fg), color(theme, bg)),
    ])
      .filter(([, , ratio]) => (ratio as number) < 3)
      .map(([fg, bg, ratio]) => `${fg}/${bg} = ${(ratio as number).toFixed(2)}`);
    expect(failures).toEqual([]);
  });

  it("cores de categoria (ícone sobre fundo suave) atingem 3:1", () => {
    const failures = CATEGORY_COLORS.map((name) => [
      name,
      contrast(color(theme, `cat-${name}`), color(theme, `cat-${name}-subtle`)),
    ])
      .filter(([, ratio]) => (ratio as number) < 3)
      .map(([name, ratio]) => `cat-${name} = ${(ratio as number).toFixed(2)}`);
    expect(failures).toEqual([]);
  });

  it("valores da paleta seguem a tabela do data-model §1.1", () => {
    const index = theme === "light" ? 0 : 1;
    for (const [token, values] of Object.entries(FIXED)) {
      expect(color(theme, token).toUpperCase(), token).toBe(values[index]);
    }
  });

  it("direção da paleta: petróleo, verde, terracota suave e neutros quentes (FR-002)", () => {
    const primary = hsl(color(theme, "primary"));
    expect(primary.h).toBeGreaterThanOrEqual(185);
    expect(primary.h).toBeLessThanOrEqual(200);

    const income = hsl(color(theme, "income"));
    expect(income.h).toBeGreaterThanOrEqual(120);
    expect(income.h).toBeLessThanOrEqual(160);

    const expense = hsl(color(theme, "expense"));
    expect(expense.h).toBeGreaterThanOrEqual(10);
    expect(expense.h).toBeLessThanOrEqual(30);
    expect(expense.s).toBeLessThan(0.7);
    // Saída nunca usa o vermelho de erro.
    expect(color(theme, "expense").toUpperCase()).not.toBe(color(theme, "danger").toUpperCase());

    for (const neutral of ["background", "surface-muted"]) {
      const { h } = hsl(color(theme, neutral));
      expect(h, neutral).toBeGreaterThanOrEqual(20);
      expect(h, neutral).toBeLessThanOrEqual(45);
    }
  });
});

it("o tema escuro por preferência do sistema é idêntico ao escuro fixado", () => {
  const css = readTokensCss();
  const media = css.slice(css.indexOf("@media (prefers-color-scheme: dark)"));
  expect(parseVars(extractBlock(media, DARK_MEDIA_SELECTOR))).toEqual(themes.dark);
});
