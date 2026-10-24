import { expect, test, type APIRequestContext } from "@playwright/test";
import { THEME_COLOR } from "../../src/styles/tokens";

/** Root layout (contracts/navigation.md §4) — FR-015, FR-018: HTML do servidor já sai certo. */
async function serverHtml(request: APIRequestContext, cookie?: string): Promise<string> {
  const response = await request.get("/", { headers: cookie ? { cookie } : {} });
  expect(response.ok()).toBe(true);
  return response.text();
}

function htmlTag(html: string): string {
  return html.match(/<html[^>]*>/)?.[0] ?? "";
}

function themeColorMetas(html: string): string[] {
  return [...html.matchAll(/<meta[^>]*name="theme-color"[^>]*>/g)].map((m) => m[0]);
}

test("sem cookie: pt-BR, sem data-theme nem data-privacy", async ({ request }) => {
  const tag = htmlTag(await serverHtml(request));
  expect(tag).toContain('lang="pt-BR"');
  expect(tag).not.toContain("data-theme");
  expect(tag).not.toContain("data-privacy");
});

for (const theme of ["light", "dark"] as const) {
  test(`cookie prumo_theme=${theme} vira atributo no HTML do servidor`, async ({ request }) => {
    const html = await serverHtml(request, `prumo_theme=${theme}`);
    expect(htmlTag(html)).toContain(`data-theme="${theme}"`);
    const metas = themeColorMetas(html);
    expect(metas).toHaveLength(1);
    expect(metas[0].toUpperCase()).toContain(THEME_COLOR[theme].toUpperCase());
  });
}

test("cookie prumo_privacy=on vira data-privacy no HTML do servidor", async ({ request }) => {
  expect(htmlTag(await serverHtml(request, "prumo_privacy=on"))).toContain('data-privacy="on"');
});

test("cookies inválidos caem no padrão", async ({ request }) => {
  const tag = htmlTag(await serverHtml(request, "prumo_theme=roxo; prumo_privacy=talvez"));
  expect(tag).not.toContain("data-theme");
  expect(tag).not.toContain("data-privacy");
});

test("viewport cobre a área segura e theme-color por mídia no automático", async ({ request }) => {
  const html = await serverHtml(request);
  const viewport = html.match(/<meta[^>]*name="viewport"[^>]*>/)?.[0] ?? "";
  expect(viewport).toContain("viewport-fit=cover");

  const metas = themeColorMetas(html);
  expect(metas).toHaveLength(2);
  const light = metas.find((m) => m.includes("prefers-color-scheme: light")) ?? "";
  const dark = metas.find((m) => m.includes("prefers-color-scheme: dark")) ?? "";
  expect(light.toUpperCase()).toContain(THEME_COLOR.light.toUpperCase());
  expect(dark.toUpperCase()).toContain(THEME_COLOR.dark.toUpperCase());
});

test("fonte Inter servida pelo próprio app", async ({ page }) => {
  const fonts: string[] = [];
  page.on("response", (response) => {
    if (response.url().endsWith(".woff2")) fonts.push(new URL(response.url()).pathname);
  });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  expect(fonts.length).toBeGreaterThan(0);
  for (const font of fonts) expect(font).toMatch(/^\/_next\/static\/media\//);
  const family = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  expect(family).toMatch(/inter/i);
});
