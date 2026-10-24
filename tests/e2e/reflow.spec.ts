import { expect, test, type Page } from "@playwright/test";

/** US4 — reflow, texto 200%, movimento reduzido e alvos de toque (FR-016, FR-021–023, SC-008). */
const SECTIONS = ["/", "/extrato", "/planejamento", "/investimentos", "/mais", "/mais/ajustes"];

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

for (const width of [320, 1920]) {
  test(`sem rolagem horizontal em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of [...SECTIONS, "/catalogo", "/catalogo/transaction-item"]) {
      await page.goto(path);
      expect(await horizontalOverflow(page), path).toBeLessThanOrEqual(0);
    }
  });
}

test("conteúdo com largura máxima legível no desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 900 });
  await page.goto("/");
  const width = await page.locator("main").evaluate((el) => el.getBoundingClientRect().width);
  expect(width).toBeLessThanOrEqual(1024 + 1);
});

test("texto a 200%: nada cortado nem rolagem horizontal", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  for (const path of SECTIONS) {
    await page.goto(path);
    await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
    expect(await horizontalOverflow(page), path).toBeLessThanOrEqual(0);
    const clipped = await page.evaluate(() =>
      [...document.querySelectorAll("main h1, main h2, main p, nav a")]
        .filter((el) => {
          const style = getComputedStyle(el);
          return (
            el.scrollWidth > el.clientWidth + 1 &&
            style.overflow === "hidden" &&
            style.textOverflow !== "ellipsis"
          );
        })
        .map((el) => el.textContent),
    );
    expect(clipped, path).toEqual([]);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
});

test("movimento reduzido: transições efetivamente zeradas", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/");
  const durations = await page
    .getByRole("navigation", { name: "Principal" })
    .getByRole("link")
    .evaluateAll((links) => links.map((l) => getComputedStyle(l).transitionDuration));
  for (const d of durations) expect(d).toMatch(/^0s(, 0s)*$/);
});

for (const viewport of [
  { width: 360, height: 780 },
  { width: 1280, height: 800 },
]) {
  test(`alvos de toque ≥ 44×44 na navegação e nos botões (${viewport.width}px)`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/mais/ajustes");
    const small = await page
      .locator('nav[aria-label="Principal"] a, main button, header button, header a')
      .evaluateAll((els) =>
        els
          .filter((el) => (el as HTMLElement).offsetParent !== null)
          .map((el) => {
            const box = el.getBoundingClientRect();
            // Alvo efetivo inclui a área de toque do ::after posicionado (ex.: Switch).
            const after = getComputedStyle(el, "::after");
            const grow = (side: string) =>
              after.position === "absolute" ? Math.max(0, -parseFloat(side) || 0) : 0;
            return {
              name: el.getAttribute("aria-label") ?? el.textContent,
              w: box.width + grow(after.left) + grow(after.right),
              h: box.height + grow(after.top) + grow(after.bottom),
            };
          })
          .filter((b) => b.w < 44 || b.h < 44),
      );
    expect(small).toEqual([]);
  });
}
