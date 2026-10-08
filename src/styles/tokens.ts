/**
 * Espelho TS dos tokens usados fora do CSS (data-model §1.1b): viewport.themeColor, manifesto e
 * gerador de ícones. Único arquivo .ts com cores literais; igualdade com tokens.css é testada em
 * tests/unit/styles-contract.test.ts.
 */
export const THEME_COLOR = { light: "#FAF8F5", dark: "#141312" } as const; // --background
export const BRAND_COLOR = "#0F4C5C"; // --primary (claro)
export const SPLASH_BACKGROUND = "#0F4C5C"; // tela de abertura: ícone claro sobre a marca
export const BRAND_INK = "#FAF8F5"; // traço do ícone sobre a marca (--background claro)
