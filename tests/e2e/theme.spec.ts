import { expect, test } from "@playwright/test";

/** US4 — tema (FR-018): automático segue o sistema sem piscar; escolha manual persiste. */
const DARK_BG = "rgb(20, 19, 18)"; // --background escuro #141312
const LIGHT_SURFACE = "rgb(255, 255, 255)"; // --surface claro #FFFFFF

test("automático: HTML do servidor sem data-theme e fundo escuro antes de qualquer script", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    baseURL,
    colorScheme: "dark",
    javaScriptEnabled: false,
  });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);
  const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(background).toBe(DARK_BG);
  await context.close();
});

for (const theme of ["light", "dark"] as const) {
  test(`cookie ${theme} vira data-theme no HTML do servidor`, async ({ request }) => {
    const html = await (
      await request.get("/", { headers: { cookie: `prumo_theme=${theme}` } })
    ).text();
    expect(html.match(/<html[^>]*>/)?.[0]).toContain(`data-theme="${theme}"`);
  });
}

test("escolha manual em Ajustes persiste após recarregar", async ({ page, context }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/mais/ajustes");
  await page.getByRole("radio", { name: "Claro" }).check();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  const cookies = await context.cookies();
  expect(cookies.find((c) => c.name === "prumo_theme")?.value).toBe("light");
  const html = await (await page.request.get("/mais/ajustes")).text();
  expect(html.match(/<html[^>]*>/)?.[0]).toContain('data-theme="light"');
});

test("Claro fixado com o sistema escuro: diálogo e popover dos primitivos ficam claros", async ({
  page,
  context,
  baseURL,
}) => {
  await context.addCookies([{ name: "prumo_theme", value: "light", url: baseURL ?? "" }]);
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/catalogo/confirm-dialog");
  await page.getByRole("button", { name: "Excluir transação" }).first().click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(LIGHT_SURFACE);
  await page.keyboard.press("Escape");

  await page.goto("/catalogo/money");
  await page.getByRole("button", { name: /reais/ }).first().click();
  const popover = page.locator("[data-slot=popover-content]").first();
  await expect(popover).toBeVisible();
  expect(await popover.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(LIGHT_SURFACE);
});
