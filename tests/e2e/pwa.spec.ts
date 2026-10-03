import { expect, test } from "@playwright/test";

test("manifesto PWA válido (FR-019)", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest).toMatchObject({
    name: "Prumo",
    short_name: "Prumo",
    display: "standalone",
    lang: "pt-BR",
    start_url: "/",
  });
  const icons: { src: string; sizes: string; purpose?: string }[] = manifest.icons;
  expect(icons.map((i) => i.sizes)).toEqual(expect.arrayContaining(["192x192", "512x512"]));
  expect(icons.some((i) => i.purpose === "maskable")).toBe(true);
  for (const icon of icons) {
    const file = await request.get(icon.src);
    expect(file.ok(), icon.src).toBe(true);
    expect(file.headers()["content-type"]).toBe("image/png");
  }
});

test("sem conexão, a navegação cai na página offline em português (FR-020)", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // Recarrega para a página passar a ser controlada pelo service worker.
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  await context.setOffline(true);
  await page.goto("/qualquer-rota");
  await expect(page.getByRole("heading", { name: "Você está sem conexão" })).toBeVisible();
  await context.setOffline(false);
});
