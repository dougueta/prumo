import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
// @ts-expect-error — módulo .mjs sem tipos (script de CI)
import { buildCiEnv } from "../../scripts/ci-env.mjs";

/**
 * 006 · T057 (FR-022, FR-027; Constitution V) — o CI roda os testes de auth contra o Supabase
 * efêmero com Mailpit, e-mails sintéticos e segredo aleatório; os nomes dos jobs da 001 são checks
 * obrigatórios (002) e não podem mudar.
 */
type Step = { name?: string; run?: string; env?: Record<string, string> };
type Job = { name: string; steps: Step[] };
const ci = parse(readFileSync(".github/workflows/ci.yml", "utf-8")) as {
  env: Record<string, string>;
  jobs: Record<string, Job>;
};
const runs = (job: Job) => job.steps.map((s) => s.run ?? "");

describe("ci.yml (006)", () => {
  it("mantém os nomes dos jobs da 001", () => {
    expect(ci.jobs.quality.name).toBe("Qualidade (lint, formato, tipos)");
    expect(ci.jobs.unit.name).toBe("Testes unitários");
    expect(ci.jobs.integration.name).toBe("Testes de integração (Supabase efêmero)");
    expect(ci.jobs.e2e.name).toBe("Testes ponta a ponta (Playwright)");
    expect(ci.jobs["deploy-db"].name).toBe("Migrações de produção");
  });

  it("sobe o Mailpit (e-mails do código de entrada)", () => {
    expect(ci.env.SUPABASE_EXCLUDE.split(",")).not.toContain("mailpit");
  });

  it('tem o job "Testes de contrato" rodando npm run test:contract', () => {
    const job = Object.values(ci.jobs).find((j) => j.name === "Testes de contrato");
    expect(job).toBeDefined();
    expect(runs(job!)).toContain("npm run test:contract");
  });

  it("o E2E instala chromium e webkit", () => {
    const install = runs(ci.jobs.e2e).find((r) => r.includes("playwright install"));
    expect(install).toMatch(/chromium/);
    expect(install).toMatch(/webkit/);
  });

  for (const key of ["integration", "e2e"] as const) {
    it(`${key}: exporta o ambiente de auth e provisiona antes dos testes`, () => {
      const steps = runs(ci.jobs[key]);
      const exportIdx = steps.findIndex((r) => r.includes("scripts/ci-supabase-env.mjs"));
      const provisionIdx = steps.findIndex((r) => r.includes("npm run auth:provision"));
      const testIdx = steps.findIndex((r) => /npm run test:(integration|e2e)/.test(r));
      expect(exportIdx).toBeGreaterThanOrEqual(0);
      expect(provisionIdx).toBeGreaterThan(exportIdx);
      expect(testIdx).toBeGreaterThan(provisionIdx);
    });
  }
});

describe("buildCiEnv (scripts/ci-env.mjs)", () => {
  const status = {
    API_URL: "http://127.0.0.1:57321",
    SECRET_KEY: "sb_secret_x",
    PUBLISHABLE_KEY: "sb_publishable_y",
    DB_URL: "postgresql://postgres:postgres@127.0.0.1:57322/postgres",
  };

  it("exporta SUPABASE_PUBLISHABLE_KEY (mesmo nome da 004) e a origem local", () => {
    const { vars } = buildCiEnv(status);
    expect(vars.SUPABASE_PUBLISHABLE_KEY).toBe("sb_publishable_y");
    expect(vars.SUPABASE_URL).toBe(status.API_URL);
    expect(vars.APP_ORIGIN).toBe("http://localhost:3000");
  });

  it("allowlist só com e-mails sintéticos @example.test", () => {
    const emails = buildCiEnv(status).vars.AUTH_ALLOWED_EMAILS.split(",");
    expect(emails.length).toBeGreaterThanOrEqual(1);
    for (const e of emails) expect(e).toMatch(/^[a-z0-9.+-]+@example\.test$/);
  });

  it("segredo de hash aleatório por execução (≥ 32 caracteres)", () => {
    const a = buildCiEnv(status).vars.AUTH_HASH_SECRET;
    const b = buildCiEnv(status).vars.AUTH_HASH_SECRET;
    expect(a.length).toBeGreaterThanOrEqual(32);
    expect(a).not.toBe(b);
  });

  it("mascara chaves, segredo e e-mails no log do Actions", () => {
    const { vars, masks } = buildCiEnv(status);
    for (const name of [
      "SUPABASE_SECRET_KEY",
      "SUPABASE_PUBLISHABLE_KEY",
      "AUTH_HASH_SECRET",
      "AUTH_ALLOWED_EMAILS",
    ]) {
      expect(masks).toContain(vars[name]);
    }
  });

  it("falha sem as credenciais do Supabase local", () => {
    expect(() => buildCiEnv({ API_URL: status.API_URL })).toThrow(/ausentes/);
  });
});
