import { expect, test } from "@playwright/test";

/**
 * SC-005 — celular intermediário em 4G: shell utilizável ≤ 2 s; troca de seção ≤ 300 ms.
 * CPU 4× e rede 4G via CDP. Orçamento de JS (plan: "JS de cliente do shell ≤ 120 kB gzip"):
 * o runtime do React 19 + Next 16 sozinho já transfere ~116 kB gzip e não é código do shell,
 * então o teste limita o total a FRAMEWORK_KB + 120 kB (decisão registrada no PR).
 */
const FRAMEWORK_KB = 120;
const SHELL_BUDGET_KB = 120;
const FAST_4G = {
  offline: false,
  latency: 60, // ms (RTT de 4G bom; padrão "Fast 4G" do DevTools é 150 ms com 1,6 Mbps)
  downloadThroughput: (9 * 1024 * 1024) / 8, // 9 Mbps
  uploadThroughput: (1.5 * 1024 * 1024) / 8,
};

test.skip(({ browserName }) => browserName !== "chromium", "CDP só no Chromium");

test("shell utilizável ≤ 2 s e troca de seção ≤ 300 ms", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", FAST_4G);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });

  const started = Date.now();
  await page.goto("/", { waitUntil: "commit" });
  // Antes do CSS chegar, as duas navegações existem no DOM: mira a barra inferior (celular).
  const nav = page.locator("[data-slot=bottom-nav]");
  await nav.getByRole("link", { name: "Extrato" }).waitFor({ state: "visible" });
  // "Clicável" = hidratado: o clique navega pelo roteador do cliente.
  await page.waitForFunction(() => document.readyState === "complete");
  const usable = Date.now() - started;
  expect(usable).toBeLessThanOrEqual(2000);

  // Deixa o prefetch dos links acontecer, como num uso real.
  await page.waitForTimeout(1500);
  // Resposta percebida (plan, risco R1): o destaque muda e aparece o esqueleto de
  // (app)/loading.tsx ou já o título da seção — o que vier primeiro.
  const before = Date.now();
  await nav.getByRole("link", { name: "Extrato" }).click();
  await page.waitForFunction(
    () => {
      const active = document.querySelector('[data-slot=bottom-nav] a[aria-current="page"]');
      const responded =
        document.querySelector("main [aria-busy=true]") !== null ||
        document.querySelector("main h1")?.textContent === "Extrato";
      return active?.textContent === "Extrato" && responded;
    },
    undefined,
    { polling: 16 },
  );
  const switched = Date.now() - before;
  expect(switched).toBeLessThanOrEqual(300);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Extrato");
});

test("JS de cliente transferido na 1ª carga dentro do orçamento", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const bytes = await page.evaluate(() =>
    (performance.getEntriesByType("resource") as PerformanceResourceTiming[])
      .filter((entry) => entry.initiatorType === "script" || entry.name.endsWith(".js"))
      .reduce((total, entry) => total + entry.transferSize, 0),
  );
  console.log(`JS transferido: ${(bytes / 1024).toFixed(1)} kB`);
  expect(bytes).toBeLessThanOrEqual((FRAMEWORK_KB + SHELL_BUDGET_KB) * 1024);
});
