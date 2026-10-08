import { expect, test, type Page } from "@playwright/test";

/** US1 — shell navegável (contracts/navigation.md). FR-007/009/011/013/014/016/020/038. */
const DESTINATIONS = [
  ["Início", "/"],
  ["Extrato", "/extrato"],
  ["Planejamento", "/planejamento"],
  ["Investimentos", "/investimentos"],
  ["Mais", "/mais"],
] as const;

const MOBILE = { width: 360, height: 780 };
const DESKTOP = { width: 1280, height: 800 };

function mainNav(page: Page) {
  return page.getByRole("navigation", { name: "Principal" });
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test("celular: barra inferior com 5 destinos e destaque do ativo", async ({ page }) => {
  await page.setViewportSize(MOBILE);
  await page.goto("/extrato");
  const nav = mainNav(page);
  await expect(nav).toBeVisible();
  await expect(nav.getByRole("link")).toHaveText(DESTINATIONS.map(([label]) => label));
  await expect(nav.getByRole("link", { name: "Extrato" })).toHaveAttribute("aria-current", "page");
  await expect(page.locator("[data-slot=side-nav]")).toBeHidden();
  const box = await nav.boundingBox();
  expect(box && box.y + box.height).toBeGreaterThan(MOBILE.height - 2);
  await expect(page.getByText("Local", { exact: true })).toBeVisible();
  await expect(page.getByText("Demonstração — dados fictícios")).toHaveCount(0);
  await expectNoHorizontalScroll(page);
});

test("desktop: menu lateral, navegação e voltar/avançar do navegador", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await page.goto("/");
  await expect(page.locator("[data-slot=bottom-nav]")).toBeHidden();
  const nav = mainNav(page);
  await expect(nav.getByRole("link")).toHaveText(DESTINATIONS.map(([label]) => label));

  await nav.getByRole("link", { name: "Planejamento" }).click();
  await expect(page).toHaveURL(/\/planejamento$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Planejamento");
  await expect(page.getByText("Em breve")).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(nav.getByRole("link", { name: "Início" })).toHaveAttribute("aria-current", "page");
  await page.goForward();
  await expect(page).toHaveURL(/\/planejamento$/);
  await expectNoHorizontalScroll(page);
});

for (const viewport of [MOBILE, DESKTOP]) {
  test(`cada destino muda a URL e o destaque (${viewport.width}px)`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    for (const [label, href] of DESTINATIONS) {
      await mainNav(page).getByRole("link", { name: label }).click();
      await expect(page).toHaveURL(new RegExp(`${href === "/" ? "/" : href}$`));
      await expect(mainNav(page).getByRole("link", { name: label })).toHaveAttribute(
        "aria-current",
        "page",
      );
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(label);
    }
  });
}

test("seções sem feature mostram 'Em breve'", async ({ page }) => {
  for (const [label, href] of DESTINATIONS.slice(0, 4)) {
    await page.goto(href);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(label);
    await expect(page.getByRole("heading", { name: "Em breve" })).toBeVisible();
  }
});

test("Mais lista os atalhos existentes", async ({ page }) => {
  await page.goto("/mais");
  const main = page.locator("main");
  await expect(main.getByRole("link", { name: /Ajustes/ })).toHaveAttribute(
    "href",
    "/mais/ajustes",
  );
  await expect(main.getByRole("link", { name: /Catálogo/ })).toHaveAttribute("href", "/catalogo");
});

test("o 1º Tab foca 'Pular para o conteúdo', que leva ao conteúdo", async ({ page }) => {
  await page.goto("/extrato");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Pular para o conteúdo" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.locator("#conteudo")).toBeFocused();
});

test("aviso offline aparece e some sozinho", async ({ page, context }) => {
  await page.goto("/");
  const text = "Você está offline. Algumas ações não vão funcionar até a conexão voltar.";
  await context.setOffline(true);
  await expect(page.getByText(text)).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByText(text)).toHaveCount(0);
});

test("URL inexistente: 404 em pt-BR, com tokens e sem a navegação", async ({ page }) => {
  const response = await page.goto("/nao-existe");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Página não encontrada");
  await expect(page.getByRole("link", { name: "Voltar ao início" })).toHaveAttribute("href", "/");
  await expect(mainNav(page)).toHaveCount(0);
  await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
  const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(["rgb(250, 248, 245)", "rgb(20, 19, 18)"]).toContain(background);
});
