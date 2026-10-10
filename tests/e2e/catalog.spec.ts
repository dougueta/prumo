import { expect, test } from "@playwright/test";

/** US6 — catálogo navegável e regras de uso (FR-045, FR-047, FR-048). */
const SECTIONS = [
  "Quando usar",
  "Quando não usar",
  "Acessibilidade",
  "Textos padrão",
  "Certo × errado",
];

test("busca pelo nome encontra o componente", async ({ page }) => {
  await page.goto("/catalogo");
  await page.getByRole("searchbox", { name: "Buscar componente" }).fill("valor");
  const result = page.getByRole("link", { name: "Valor monetário" });
  await expect(result).toBeVisible();
  await expect(page.getByRole("link", { name: "Item de transação" })).toBeHidden();
  await result.click();
  await expect(page).toHaveURL(/\/catalogo\/money$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Valor monetário");
});

test("toda página de componente tem as seções de regras de uso", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/catalogo");
  const hrefs = await page
    .locator('main a[href^="/catalogo/"]:not([href^="/catalogo/fundamentos"])')
    .evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));
  const components = [...new Set(hrefs)].filter(
    (href) => !["/catalogo/escrita", "/catalogo/exemplo-extrato"].includes(href),
  );
  expect(components.length).toBeGreaterThan(20);
  for (const href of components) {
    await page.goto(href);
    for (const section of SECTIONS) {
      await expect(
        page.getByRole("heading", { level: 2, name: section }),
        `${href}: ${section}`,
      ).toBeVisible();
    }
  }
});

test("controles de tema e privacidade da página refletem na hora", async ({ page }) => {
  await page.goto("/catalogo/money");
  await page.getByRole("radio", { name: "Escuro" }).check();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe("rgb(20, 19, 18)");
  await page.getByRole("switch", { name: "Ocultar valores" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-privacy", "on");
  await expect(page.locator("main [data-money-mask]").first()).toBeVisible();
});

test("guia de escrita lista os textos padrão", async ({ page }) => {
  await page.goto("/catalogo/escrita");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Guia de escrita");
  for (const text of [
    "Não foi possível carregar.",
    "Tentar novamente",
    "Nenhum resultado para este filtro.",
    "Sem conexão: nada foi salvo. Tente de novo quando a conexão voltar.",
    "Página não encontrada",
  ]) {
    await expect(page.getByText(text, { exact: true }).first()).toBeVisible();
  }
  await expect(page.getByText("entrada", { exact: true }).first()).toBeVisible();
});

test("fundamentos: cores com nome, valor e contraste", async ({ page }) => {
  await page.goto("/catalogo/fundamentos/cores");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Cores");
  await expect(page.getByText("--income").first()).toBeVisible();
  await expect(page.getByText(/#2B7249/i).first()).toBeVisible();
  for (const topic of ["tipografia", "espacamento", "icones", "movimento"]) {
    const response = await page.goto(`/catalogo/fundamentos/${topic}`);
    expect(response?.status(), topic).toBe(200);
  }
});
