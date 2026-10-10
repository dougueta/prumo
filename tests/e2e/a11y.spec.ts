import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * US4 — 0 violações WCAG 2.1 A/AA (SC-002, FR-019, FR-020) no shell, no catálogo e nas telas
 * fora do shell, nos dois temas e em celular/desktop.
 */
const SHELL = ["/", "/extrato", "/planejamento", "/investimentos", "/mais", "/mais/ajustes"];
const OUTSIDE = ["/~offline", "/nao-existe"];
const THEMES = ["light", "dark"] as const;
const VIEWPORTS = [
  { width: 360, height: 780 },
  { width: 1280, height: 800 },
];

async function catalogRoutes(page: Page): Promise<string[]> {
  await page.goto("/catalogo");
  const hrefs = await page
    .locator('main a[href^="/catalogo"]')
    .evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));
  return ["/catalogo", ...new Set(hrefs.filter((href) => href !== "/catalogo"))];
}

async function audit(page: Page, path: string): Promise<string[]> {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  return results.violations.map(
    (v) => `${path}: ${v.id} — ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
  );
}

for (const theme of THEMES) {
  for (const viewport of VIEWPORTS) {
    test(`axe sem violações — tema ${theme}, ${viewport.width}px`, async ({
      page,
      context,
      baseURL,
    }) => {
      test.setTimeout(180_000);
      await context.addCookies([{ name: "prumo_theme", value: theme, url: baseURL ?? "" }]);
      await page.setViewportSize(viewport);
      const routes = [...SHELL, ...OUTSIDE, ...(await catalogRoutes(page))];
      const violations: string[] = [];
      for (const path of routes) violations.push(...(await audit(page, path)));
      expect(violations).toEqual([]);
    });
  }
}
