import { mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildCatalogSeedSql, runSeedCli } from "../../../scripts/generate-category-seed";

// 004 · T068 — seed gerado e versionado (R-12, FR-005, FR-029).
const silent = { log: () => {}, error: () => {} };

describe("buildCatalogSeedSql", () => {
  const sql = buildCatalogSeedSql();

  it("é determinístico", () => {
    expect(buildCatalogSeedSql()).toBe(sql);
  });

  it("insere 99 modelos de categoria", () => {
    const templates = sql.split("INSERT INTO public.category_templates")[1].split(";")[0];
    expect(templates.match(/^\s*\('/gm)).toHaveLength(99);
  });

  it("insere 11 instituições de catálogo com UUIDs fixos (Outra = 999)", () => {
    const institutions = sql.split("INSERT INTO public.institutions")[1].split(";")[0];
    const ids = [...institutions.matchAll(/'(00000000-0000-4000-a000-000000000\d{3})'/g)].map(
      (m) => m[1],
    );
    expect(ids).toHaveLength(11);
    for (const name of ["Mercado Pago", "Caixa Econômica Federal", "PicPay", "C6 Bank"]) {
      expect(institutions).toContain(`'${name}'`);
    }
    expect(institutions).toMatch(
      /'00000000-0000-4000-a000-000000000999', NULL, 'Outra instituição', 'other', NULL/,
    );
  });
});

describe("generate-category-seed --check", () => {
  it("passa quando a migração versionada é idêntica e falha quando diverge", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "prumo-seed-"));
    const file = path.join(dir, "20990101000000_core_seed_catalog.sql");
    writeFileSync(file, buildCatalogSeedSql());
    expect(runSeedCli(["--check", "--dir", dir], silent)).toBe(0);
    writeFileSync(file, buildCatalogSeedSql() + "-- editado à mão\n");
    expect(runSeedCli(["--check", "--dir", dir], silent)).toBe(1);
  });

  it("a migração versionada no repositório está em dia com a taxonomia", () => {
    const files = readdirSync("supabase/migrations").filter((f) =>
      f.endsWith("_core_seed_catalog.sql"),
    );
    expect(files).toHaveLength(1);
    expect(runSeedCli(["--check"], silent)).toBe(0);
  });
});
