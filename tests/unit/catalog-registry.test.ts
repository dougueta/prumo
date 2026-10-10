import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CATALOG, CATALOG_EXEMPT } from "@/catalog/registry";

/** contracts/catalog.md §2 — FR-045, FR-047, SC-001. */
const ROOT = path.resolve(__dirname, "../..");
const GROUPS = ["finance", "states", "forms", "shell"];

const MODULES = GROUPS.flatMap((group) =>
  readdirSync(path.join(ROOT, "src/components", group))
    .filter((file) => /\.(ts|tsx)$/.test(file))
    .map((file) => `@/components/${group}/${file.replace(/\.(ts|tsx)$/, "")}`),
);

// Variantes/estados que cada página precisa mostrar (contracts/components.md).
const REQUIRED_STATES: Record<string, string[]> = {
  money: ["movimentação", "saldo", "neutra", "compacta", "ausente", "outra moeda"],
  "relative-date": ["relativa", "absoluta"],
  "period-label": ["mês", "intervalo"],
  "transaction-item": [
    "normal",
    "compacta",
    "pendente",
    "parcela",
    "entre contas",
    "pagamento de fatura",
    "estorno",
    "moeda original",
    "sem categoria",
    "descrição longa",
  ],
  "summary-card": ["pronto", "variação", "compacto", "carregando", "erro", "vazio"],
  "grouped-list": ["com grupos", "vazia"],
  "source-badge": ["manual", "regra", "fonte", "IA alta", "IA média", "IA baixa"],
  "empty-state": ["vazio", "sem resultados"],
  "loading-skeleton": ["lista", "card", "página", "texto"],
  "error-state": ["bloco", "página"],
  "confirm-dialog": ["destrutivo"],
  "money-input": ["saída", "entrada", "escolher"],
  "select-field": ["até 7 opções", "mais de 7 opções"],
};

describe("registro do catálogo", () => {
  it("todo módulo de finance/states/forms/shell tem entrada (ou é isento)", () => {
    const covered = new Set([
      ...CATALOG.flatMap((entry) => [entry.importPath, ...(entry.alsoCovers ?? [])]),
      ...CATALOG_EXEMPT,
    ]);
    expect(MODULES.filter((module) => !covered.has(module))).toEqual([]);
  });

  it("slugs únicos", () => {
    const slugs = CATALOG.map((entry) => entry.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("toda entrada tem regras de uso completas e exemplos certo × errado", () => {
    const incomplete = CATALOG.filter(
      (entry) =>
        entry.whenToUse.length === 0 ||
        entry.whenNotToUse.length === 0 ||
        entry.a11y.length === 0 ||
        !entry.examples.some((example) => example.kind === "do") ||
        !entry.examples.some((example) => example.kind === "dont"),
    ).map((entry) => entry.slug);
    expect(incomplete).toEqual([]);
  });

  it("cada página mostra todas as variantes e estados do contrato", () => {
    const missing = Object.entries(REQUIRED_STATES).flatMap(([slug, states]) => {
      const entry = CATALOG.find((e) => e.slug === slug);
      if (!entry) return [`${slug}: sem entrada`];
      return states.filter((s) => !entry.states.includes(s)).map((s) => `${slug}: ${s}`);
    });
    expect(missing).toEqual([]);
  });

  it("estados declarados têm exemplo com o mesmo título", () => {
    const orphans = CATALOG.flatMap((entry) =>
      entry.states
        .filter((state) => !entry.examples.some((example) => example.title === state))
        .map((state) => `${entry.slug}: ${state}`),
    );
    expect(orphans).toEqual([]);
  });

  it("grupos válidos e nome em português", () => {
    for (const entry of CATALOG) {
      expect(["financas", "estados", "formularios", "shell"]).toContain(entry.group);
      expect(entry.name.length).toBeGreaterThan(2);
    }
  });
});
