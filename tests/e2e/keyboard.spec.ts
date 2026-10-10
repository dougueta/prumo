import { expect, test } from "@playwright/test";

/** US4 — teclado (FR-020, FR-024, SC-007). */
test("'Pular para o conteúdo' é o primeiro Tab", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Pular para o conteúdo" })).toBeFocused();
});

test("foco visível (contorno ≥ 2px na cor de foco) em todo interativo, na ordem visual", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/mais");
  const seen: { name: string; outline: number; color: string; top: number; left: number }[] = [];
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const style = getComputedStyle(el);
      const box = el.getBoundingClientRect();
      const focus = getComputedStyle(document.documentElement).getPropertyValue("--focus").trim();
      return {
        name: el.getAttribute("aria-label") ?? el.textContent?.trim() ?? el.tagName,
        outline: parseFloat(style.outlineWidth),
        color: style.outlineColor,
        focus,
        top: box.top,
        left: box.left,
        visible: box.width > 0 && box.height > 0,
      };
    });
    if (!info) break;
    if (info.visible) seen.push(info);
  }
  expect(seen.length).toBeGreaterThan(5);
  for (const item of seen) expect(item.outline, item.name).toBeGreaterThanOrEqual(2);
  // Ordem visual: menu lateral (de cima para baixo), depois o conteúdo.
  const names = seen.map((s) => s.name);
  expect(names.indexOf("Início")).toBeLessThan(names.indexOf("Mais"));
  expect(names.indexOf("Mais")).toBeLessThan(names.findIndex((n) => n.includes("Ajustes")));
});

test("diálogo prende o foco, Esc fecha e devolve ao gatilho", async ({ page }) => {
  await page.goto("/catalogo/confirm-dialog");
  const trigger = page.getByRole("button", { name: "Excluir transação" }).first();
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Tab");
    expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("voltar do navegador com diálogo aberto fecha o diálogo e mantém a página", async ({
  page,
}) => {
  await page.goto("/catalogo/confirm-dialog");
  await page.getByRole("button", { name: "Excluir transação" }).first().click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.evaluate(() => history.back());
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(page).toHaveURL(/\/catalogo\/confirm-dialog$/);
});
