import { expect, test } from "@playwright/test";

test("tela inicial exibe Prumo em pt-BR (FR-001, FR-021)", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Prumo" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
  await expect(page.getByText("Demonstração — dados fictícios")).toHaveCount(0);
});

test("verificação de saúde responde ok em ambiente local (FR-002)", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({
    status: "ok",
    environment: "local",
    data: { status: "ok" },
  });
});
