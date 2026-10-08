import { defineConfig, devices } from "@playwright/test";

process.env.TZ = "America/Sao_Paulo";

const LOCAL_PORT = 3100;
const DEMO_PORT = 3101;
const LOCAL_URL = `http://localhost:${LOCAL_PORT}`;
const DEMO_URL = `http://localhost:${DEMO_PORT}`;

// Specs que rodam em modo demonstração (APP_ENV=preview) e não no servidor local.
const DEMO_SPECS = /demo\.spec\.ts/;
// Comparação de aparência: só em Linux (baselines geradas na imagem oficial do Playwright).
const VISUAL_SPECS = /visual\.spec\.ts/;
// Specs de layout que também rodam num aparelho móvel emulado (toque, viewport estreita).
const MOBILE_SPECS = /(home|pwa|shell|privacy)\.spec\.ts/;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["html", { open: "never" }], ["github"]] : "list",
  use: { locale: "pt-BR", timezoneId: "America/Sao_Paulo", trace: "retain-on-failure" },
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: "disabled" } },
  snapshotPathTemplate: "{testDir}/{testFileName}-snapshots/{arg}{ext}",
  projects: [
    {
      name: "chromium",
      testIgnore: [DEMO_SPECS, VISUAL_SPECS],
      use: { ...devices["Desktop Chrome"], baseURL: LOCAL_URL },
    },
    {
      name: "mobile-chrome",
      testMatch: MOBILE_SPECS,
      use: { ...devices["Pixel 7"], baseURL: LOCAL_URL },
    },
    {
      name: "demo",
      testMatch: DEMO_SPECS,
      use: { ...devices["Desktop Chrome"], baseURL: DEMO_URL },
    },
    ...(process.platform === "linux"
      ? [
          {
            name: "visual",
            testMatch: VISUAL_SPECS,
            // Modo demonstração: não depende de banco (roda também dentro do Docker).
            use: { ...devices["Desktop Chrome"], baseURL: DEMO_URL },
          },
        ]
      : []),
  ],
  // Um único build serve aos dois servidores: o ambiente é lido em runtime (ver data-model §3).
  // VISUAL_ONLY=1 (scripts/visual-update.mjs) sobe só o servidor de demonstração.
  webServer: [
    ...(process.env.VISUAL_ONLY
      ? []
      : [
          {
            command: `npx next start -p ${LOCAL_PORT}`,
            url: `${LOCAL_URL}/api/health`,
            reuseExistingServer: !process.env.CI,
            env: { APP_ENV: "local" },
          },
        ]),
    {
      command: `node scripts/start-demo.mjs ${DEMO_PORT}`,
      url: `${DEMO_URL}/api/health`,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
