import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";
import { BRAND_COLOR, SPLASH_BACKGROUND } from "../../src/styles/tokens";

// Hashes (sha256, 16 primeiros) dos ícones provisórios da 001 — a 003 regenera com o Logo.
const PROVISIONAL_ICON_HASHES = [
  "8ba0ac29ed6890cb",
  "358e2fedd96f28f7",
  "e40b2fe9a292330b",
  "a75d05570bbe7f9e",
];

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

test("manifesto e ícones usam a identidade da 003 (FR-006)", async ({ request }) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest.theme_color.toUpperCase()).toBe(BRAND_COLOR.toUpperCase());
  expect(manifest.background_color.toUpperCase()).toBe(SPLASH_BACKGROUND.toUpperCase());
  const sources: string[] = [
    ...manifest.icons.map((icon: { src: string }) => icon.src),
    "/icons/apple-touch-icon.png",
  ];
  for (const src of sources) {
    const body = await (await request.get(src)).body();
    const hash = createHash("sha256").update(body).digest("hex").slice(0, 16);
    expect(PROVISIONAL_ICON_HASHES, src).not.toContain(hash);
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

test("página offline estilizada com o design system depois da 1ª visita (FR-006)", async ({
  page,
  context,
  request,
}) => {
  const sw = await (await request.get("/sw.js")).text();
  expect(sw).toContain('const CACHE = "prumo-shell-v2"');

  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  // Mais uma carga controlada pelo SW: CSS e fontes passam pelo cache de runtime.
  await page.reload();

  await context.setOffline(true);
  await page.goto("/outra-rota");
  await expect(page.getByRole("heading", { name: "Você está sem conexão" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Prumo" })).toBeVisible();
  const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(["rgb(250, 248, 245)", "rgb(20, 19, 18)"]).toContain(background);
  await context.setOffline(false);
});
