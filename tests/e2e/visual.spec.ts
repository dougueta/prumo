import { expect, test } from "@playwright/test";

/**
 * Aparência (FR-049, SC-001): screenshot de cada página do catálogo × claro/escuro × 360/1280.
 * Só no projeto "visual" (Linux); baselines geradas por `npm run test:visual:update`.
 * "Hoje" do catálogo é fixo (CATALOG_TODAY), então as datas relativas não mudam.
 */
const VIEWPORTS = [
  { width: 360, height: 780 },
  { width: 1280, height: 800 },
];

test("baselines visuais do catálogo", async ({ browser, baseURL }) => {
  test.setTimeout(600_000);
  const index = await browser.newPage({ baseURL });
  await index.goto("/catalogo");
  const hrefs = await index
    .locator('main a[href^="/catalogo"]')
    .evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));
  await index.close();
  const routes = ["/catalogo", ...new Set(hrefs.filter((h) => h !== "/catalogo"))];

  for (const theme of ["light", "dark"] as const) {
    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({ baseURL, viewport, reducedMotion: "reduce" });
      await context.addCookies([{ name: "prumo_theme", value: theme, url: baseURL ?? "" }]);
      const page = await context.newPage();
      for (const route of routes) {
        await page.goto(route);
        await page.evaluate(() => document.fonts.ready);
        const name = `${route.replace(/^\//, "").replaceAll("/", "__")}-${theme}-${viewport.width}.png`;
        await expect.soft(page).toHaveScreenshot(name, { fullPage: true });
      }
      await context.close();
    }
  }
});
