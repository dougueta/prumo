/**
 * Espelho TS dos tokens usados fora do CSS (data-model §1.1b): viewport.themeColor, manifesto e
 * gerador de ícones. Único arquivo .ts com cores literais; igualdade com tokens.css é testada em
 * tests/unit/styles-contract.test.ts.
 */
export const THEME_COLOR = { light: "#FAF8F5", dark: "#141312" } as const; // --background
export const BRAND_COLOR = "#0F4C5C"; // --primary (claro)
export const SPLASH_BACKGROUND = "#0F4C5C"; // tela de abertura: ícone claro sobre a marca
export const BRAND_INK = "#FAF8F5"; // traço do ícone sobre a marca (--background claro)

/**
 * Todas as cores de tokens.css ([claro, escuro]) para o catálogo exibir nome, valor e contraste
 * (fundamentos/cores). Igualdade com tokens.css testada em styles-contract.test.ts.
 */
export const COLOR_TOKENS: Record<string, readonly [light: string, dark: string]> = {
  background: ["#FAF8F5", "#141312"],
  surface: ["#FFFFFF", "#1D1B19"],
  "surface-muted": ["#F2EFEA", "#262320"],
  foreground: ["#1F2421", "#EEEAE4"],
  "foreground-muted": ["#5E5850", "#B3ACA2"],
  border: ["#E3DED6", "#3A3632"],
  "border-strong": ["#8C857B", "#7D766C"],
  primary: ["#0F4C5C", "#6CBACB"],
  "primary-foreground": ["#FFFFFF", "#0B1F25"],
  "primary-subtle": ["#DDEBEE", "#17323A"],
  info: ["#1E3A5F", "#93B5E1"],
  "info-subtle": ["#E3EAF3", "#1B2636"],
  income: ["#2B7249", "#7DC79C"],
  "income-subtle": ["#E5F1E9", "#1C2E23"],
  expense: ["#A14A2B", "#E59C7E"],
  "expense-subtle": ["#F7E7E0", "#3A241B"],
  warning: ["#7A5200", "#E9BC5E"],
  "warning-subtle": ["#FBF0D6", "#33280F"],
  danger: ["#B42318", "#F28B82"],
  "danger-foreground": ["#FFFFFF", "#141312"],
  "danger-subtle": ["#FBE9E7", "#3B1A17"],
  ai: ["#5B3F96", "#BCA6EC"],
  "ai-subtle": ["#EFEAF8", "#2A2340"],
  focus: ["#1F6F8B", "#7FC8DA"],
  demo: ["#FBF0D6", "#33280F"],
  "demo-foreground": ["#5C3D00", "#F3D58F"],
  overlay: ["#14131299", "#00000099"],
  "cat-petroleo": ["#1F6B78", "#7CC8D6"],
  "cat-petroleo-subtle": ["#DCEFF2", "#17333A"],
  "cat-azul": ["#2C5A99", "#9BBBEA"],
  "cat-azul-subtle": ["#E1EAF7", "#1C2A40"],
  "cat-verde": ["#2E7340", "#8ACF98"],
  "cat-verde-subtle": ["#E2F2E5", "#1B3021"],
  "cat-oliva": ["#5E6A1E", "#C3CF7E"],
  "cat-oliva-subtle": ["#EEF1DC", "#2A2E14"],
  "cat-ambar": ["#8A5A00", "#E9BC5E"],
  "cat-ambar-subtle": ["#FBEFD5", "#33280F"],
  "cat-terracota": ["#A24A2C", "#E59C7E"],
  "cat-terracota-subtle": ["#F8E5DD", "#3A241B"],
  "cat-rosa": ["#A23A63", "#EE9BBB"],
  "cat-rosa-subtle": ["#F8E2EB", "#3A1C29"],
  "cat-violeta": ["#5E43A0", "#BCA6EC"],
  "cat-violeta-subtle": ["#ECE6F7", "#2A2340"],
  "cat-cinza": ["#5E5850", "#C4BDB3"],
  "cat-cinza-subtle": ["#EEEBE6", "#2D2A26"],
};
