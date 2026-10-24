import { expect, test, type Page } from "@playwright/test";

/** US5 — modo privacidade (FR-017, FR-027, FR-031). */
async function money(page: Page) {
  return page.locator("main [data-money]:has([data-money-value])");
}

test("ocultar valores mascara tudo, com largura igual, inclusive para leitor de tela", async ({
  page,
}) => {
  for (const path of ["/catalogo/money", "/catalogo/summary-card"]) {
    await page.goto(path);
    await page.getByRole("button", { name: "Ocultar valores" }).first().click();
    const values = await money(page);
    const count = await values.count();
    expect(count, path).toBeGreaterThan(1);
    const widths = new Set<number>();
    for (let i = 0; i < count; i++) {
      const value = values.nth(i);
      if (!(await value.isVisible())) continue;
      await expect(value.locator("[data-money-mask]")).toBeVisible();
      await expect(value.locator("[data-money-value]")).toBeHidden();
      const mask = value.locator("[data-money-mask] [aria-hidden=true]");
      widths.add(Math.round((await mask.boundingBox())?.width ?? 0));
    }
    // Máscaras do mesmo tamanho de fonte têm a mesma largura (não revelam a grandeza).
    expect(widths.size, path).toBeLessThanOrEqual(4);
    // Exemplos reais (Variantes e estados); os "errados" são ilustrações estáticas.
    const examples = page.locator("section", {
      has: page.getByRole("heading", { level: 2, name: "Variantes e estados" }),
    });
    const tree = await examples.ariaSnapshot();
    expect(tree).toContain("valor oculto");
    expect(tree).not.toMatch(/R\$\s?1/);
    await page.getByRole("button", { name: "Mostrar valores" }).first().click();
  }
});

test("a escolha persiste: o HTML do servidor já vem com data-privacy", async ({ page }) => {
  await page.goto("/catalogo/money");
  await page.getByRole("button", { name: "Ocultar valores" }).first().click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-privacy", "on");
  const html = await (await page.request.get("/catalogo/money")).text();
  expect(html.match(/<html[^>]*>/)?.[0]).toContain('data-privacy="on"');
});

test("o switch dos Ajustes controla o mesmo estado do cabeçalho", async ({ page }) => {
  await page.goto("/mais/ajustes");
  const sw = page.getByRole("switch", { name: "Ocultar valores" });
  await expect(sw).toHaveAttribute("aria-checked", "false");
  await page.getByRole("button", { name: "Ocultar valores" }).click();
  await expect(sw).toHaveAttribute("aria-checked", "true");
  await sw.click();
  await expect(page.locator("html")).not.toHaveAttribute("data-privacy", /.+/);
  await expect(page.getByRole("button", { name: "Ocultar valores" })).toBeVisible();
});

test("campo de valor mostra o que é digitado mesmo com valores ocultos", async ({ page }) => {
  await page.goto("/catalogo/money-input");
  await page.getByRole("button", { name: "Ocultar valores" }).first().click();
  const input = page.getByLabel("Valor", { exact: true }).first();
  await input.fill("1234,5");
  await input.blur();
  await expect(input).toHaveValue("R$ 1.234,50");
  await expect(input).toBeVisible();
});
