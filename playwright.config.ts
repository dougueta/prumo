import { defineConfig, devices } from "@playwright/test";

process.env.TZ = "America/Sao_Paulo";

const LOCAL_PORT = 3100;
const DEMO_PORT = 3101;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["html", { open: "never" }], ["github"]] : "list",
  use: { locale: "pt-BR", timezoneId: "America/Sao_Paulo", trace: "retain-on-failure" },
  projects: [
    {
      name: "chromium",
      testIgnore: /demo\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], baseURL: `http://localhost:${LOCAL_PORT}` },
    },
    {
      name: "mobile-chrome",
      testMatch: /(home|pwa)\.spec\.ts/,
      use: { ...devices["Pixel 7"], baseURL: `http://localhost:${LOCAL_PORT}` },
    },
    {
      name: "demo",
      testMatch: /demo\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], baseURL: `http://localhost:${DEMO_PORT}` },
    },
  ],
  // Um único build serve aos dois servidores: o ambiente é lido em runtime (ver data-model §3).
  webServer: [
    {
      command: `npx next start -p ${LOCAL_PORT}`,
      url: `http://localhost:${LOCAL_PORT}/api/health`,
      reuseExistingServer: !process.env.CI,
      env: { APP_ENV: "local" },
    },
    {
      command: `node scripts/start-demo.mjs ${DEMO_PORT}`,
      url: `http://localhost:${DEMO_PORT}/api/health`,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
