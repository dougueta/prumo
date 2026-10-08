import { expect, test } from "@playwright/test";

// Projeto "demo": mesmo build, servidor com APP_ENV=preview e sem SUPABASE_* (FR-011, ADR 0006).
const BADGE = "Demonstração — dados fictícios";
const PAGES = ["/", "/extrato", "/planejamento", "/investimentos", "/mais", "/catalogo"];

for (const path of PAGES) {
  test(`selo de demonstração em ${path} (FR-012)`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByText(BADGE)).toBeVisible();
    await expect(page.getByText("Local", { exact: true })).toHaveCount(0);
  });
}

test("selo também fora do shell: 404 e página offline (FR-012)", async ({ page }) => {
  await page.goto("/nao-existe");
  await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
  await expect(page.getByText(BADGE)).toBeVisible();
  await page.goto("/~offline");
  await expect(page.getByText(BADGE)).toBeVisible();
});

test("selo visível e acima do véu com um diálogo aberto (edge case)", async ({ page }) => {
  await page.goto("/catalogo/confirm-dialog");
  await page.getByRole("button", { name: "Excluir transação" }).first().click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  const badge = page.getByText(BADGE);
  await expect(badge).toBeVisible();
  const box = await badge.boundingBox();
  if (!box) throw new Error("selo sem caixa");
  const topmost = await page.evaluate(
    ({ x, y }) => document.elementFromPoint(x, y)?.textContent ?? "",
    { x: box.x + box.width / 2, y: box.y + box.height / 2 },
  );
  expect(topmost).toContain(BADGE);
});

test("health em modo demonstração não toca no banco", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({
    status: "ok",
    environment: "preview",
    data: { status: "demo", latencyMs: null },
  });
});
