import { describe, expect, it } from "vitest";
import {
  CATALOG_TODAY,
  buildCatalogExamples,
  catalogDataset,
  catalogExamples,
  fnv1a,
} from "@/catalog/examples";

/**
 * data-model §7 e §8 — exemplos do catálogo derivados do gerador sintético (seed 42) por regras
 * determinísticas; nada escrito à mão (Constitution II, FR-045, FR-050).
 */
const dataset = catalogDataset();
const examples = catalogExamples();
const byId = new Map(dataset.transactions.map((tx) => [tx.id, tx]));

describe("exemplos do catálogo", () => {
  it("determinístico: duas construções dão o mesmo resultado", () => {
    expect(buildCatalogExamples()).toEqual(buildCatalogExamples());
  });

  it("'hoje' do catálogo é a data âncora do dataset", () => {
    expect(CATALOG_TODAY).toBe("2026-09-30");
    expect(dataset.anchorDate).toBe(CATALOG_TODAY);
    expect(dataset.seed).toBe(42);
  });

  it("descrição, valor, data e conta vêm do dataset", () => {
    for (const item of examples.transactions) {
      const tx = byId.get(item.id);
      expect(tx, item.id).toBeDefined();
      expect(item.description).toBe(tx?.description);
      expect(item.amountCents).toBe(tx?.amountCents);
      expect(item.date).toBe(tx?.date);
      const account = dataset.accounts.find((a) => a.id === tx?.accountId);
      expect(item.account.name).toBe(account?.name);
    }
  });

  it("toda linha da tabela do data-model §7 aparece", () => {
    const kindOf = (id: string) => byId.get(id)?.kind;
    const find = (pred: (item: (typeof examples.transactions)[number]) => boolean) =>
      examples.transactions.some(pred);

    expect(
      find(
        (i) =>
          kindOf(i.id) === "salary" &&
          i.category?.visual === "salario" &&
          i.categorization?.origin === "source",
      ),
    ).toBe(true);
    expect(
      find(
        (i) =>
          kindOf(i.id) === "subscription" &&
          i.category?.visual === "assinaturas-e-servicos" &&
          i.categorization?.origin === "rule",
      ),
    ).toBe(true);
    expect(
      find(
        (i) =>
          kindOf(i.id) === "installment" &&
          i.category?.visual === "compras" &&
          i.installment !== undefined,
      ),
    ).toBe(true);
    expect(
      find((i) => kindOf(i.id) === "transfer_internal" && i.nature === "internal_transfer"),
    ).toBe(true);
    expect(find((i) => kindOf(i.id) === "card_bill_payment" && i.nature === "card_payment")).toBe(
      true,
    );
    expect(
      find(
        (i) =>
          kindOf(i.id) === "refund" && i.nature === "refund" && i.category?.visual === "reembolsos",
      ),
    ).toBe(true);
    expect(
      find(
        (i) =>
          kindOf(i.id) === "international" &&
          i.original !== undefined &&
          i.category?.visual === "viagens",
      ),
    ).toBe(true);
    expect(
      find((i) => kindOf(i.id) === "fee" && i.category?.visual === "impostos-tarifas-e-juros"),
    ).toBe(true);
    expect(
      find((i) => kindOf(i.id) === "income_other" && i.categorization?.origin === "manual"),
    ).toBe(true);
    for (const confidence of ["high", "medium", "low"] as const) {
      expect(
        find(
          (i) =>
            kindOf(i.id) === "purchase" &&
            i.categorization?.origin === "ai" &&
            i.categorization.confidence === confidence,
        ),
        confidence,
      ).toBe(true);
    }
    expect(find((i) => kindOf(i.id) === "purchase" && i.category === null)).toBe(true);
    expect(find((i) => i.status === "pending")).toBe(true);
  });

  it("regra das compras segue o hash estável do id", () => {
    for (const item of examples.transactions.filter((i) => byId.get(i.id)?.kind === "purchase")) {
      const h = fnv1a(item.id) % 100;
      if (h % 13 === 0) {
        expect(item.category).toBeNull();
        continue;
      }
      const expected =
        h < 30
          ? "alimentacao"
          : h < 50
            ? "transporte"
            : h < 70
              ? "compras"
              : h < 85
                ? "lazer"
                : "saude";
      expect(item.category?.visual).toBe(expected);
    }
  });

  it("pendente só nas transações a partir da véspera da âncora", () => {
    for (const item of examples.transactions) {
      expect(item.status === "pending").toBe(item.date >= "2026-09-29");
    }
  });
});
