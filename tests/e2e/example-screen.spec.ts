import { expect, test } from "@playwright/test";
import { COLOR_TOKENS } from "../../src/styles/tokens";

/**
 * SC-006 / FR-004 — uma tela montada só com componentes do catálogo usa apenas valores dos
 * fundamentos: cores dos tokens do tema ativo e tamanhos da escala tipográfica.
 */
const FONT_SIZES = new Set(["12px", "14px", "16px", "18px", "20px", "24px", "30px"]);

function toCss(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  if (hex.length === 9) {
    const alpha = Math.round((parseInt(hex.slice(7, 9), 16) / 255) * 100) / 100;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return `rgb(${r}, ${g}, ${b})`;
}

for (const [index, theme] of (["light", "dark"] as const).entries()) {
  test(`tela de exemplo só usa tokens — tema ${theme}`, async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: "prumo_theme", value: theme, url: baseURL ?? "" }]);
    const response = await page.goto("/catalogo/exemplo-extrato");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const allowed = new Set([
      ...Object.values(COLOR_TOKENS).map((pair) => toCss(pair[index])),
      "rgba(0, 0, 0, 0)",
    ]);

    const report = await page.locator("main").evaluate((main) => {
      const inlineStyled: string[] = [];
      const colors: string[] = [];
      const sizes: string[] = [];
      for (const el of [main, ...main.querySelectorAll<HTMLElement>("*")]) {
        const style = el.getAttribute("style") ?? "";
        if (/color|background|font-size|border/i.test(style))
          inlineStyled.push(el.outerHTML.slice(0, 80));
        const computed = getComputedStyle(el);
        if (computed.display === "none") continue;
        colors.push(computed.color, computed.backgroundColor);
        if (parseFloat(computed.borderTopWidth) > 0) colors.push(computed.borderTopColor);
        if (
          el.childNodes.length &&
          [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent?.trim())
        ) {
          sizes.push(computed.fontSize);
        }
      }
      return { inlineStyled, colors, sizes };
    });

    expect(report.inlineStyled).toEqual([]);
    expect([...new Set(report.colors)].filter((c) => !allowed.has(c))).toEqual([]);
    expect([...new Set(report.sizes)].filter((s) => !FONT_SIZES.has(s))).toEqual([]);
  });
}
