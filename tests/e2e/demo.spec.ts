import { expect, test } from "@playwright/test";

// Projeto "demo": mesmo build, servidor com APP_ENV=preview e sem SUPABASE_* (FR-011, ADR 0006).
test("pré-visualização exibe o selo de demonstração", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Demonstração — dados fictícios")).toBeVisible();
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
