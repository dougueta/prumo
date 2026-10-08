import { describe, expect, it } from "vitest";
import { DEFAULT_CATEGORIES } from "@/domain/core/default-categories";
import { nameKey } from "@/domain/core/text";

// 004 · T009 — taxonomia padrão estilo GuiaBolso (data-model §4, FR-029).
const top = DEFAULT_CATEGORIES.filter((c) => c.parentKey === null);
const sub = DEFAULT_CATEGORIES.filter((c) => c.parentKey !== null);
const bySystemKey = (key: string) => DEFAULT_CATEGORIES.find((c) => c.systemKey === key);

describe("DEFAULT_CATEGORIES", () => {
  it("tem 24 categorias de 1º nível e 75 subcategorias (99 no total)", () => {
    expect(top).toHaveLength(24);
    expect(sub).toHaveLength(75);
  });

  it("15 despesas, 5 receitas, 3 neutras + Sem categoria", () => {
    const regular = top.filter((c) => c.systemKey !== "uncategorized");
    expect(regular.filter((c) => c.kind === "expense")).toHaveLength(15);
    expect(regular.filter((c) => c.kind === "income")).toHaveLength(5);
    expect(regular.filter((c) => c.kind === "neutral")).toHaveLength(3);
    expect(bySystemKey("uncategorized")).toMatchObject({
      name: "Sem categoria",
      parentKey: null,
      kind: "expense",
    });
  });

  it("chaves de sistema exatas, com bank_fees em Impostos, tarifas e juros", () => {
    const keys = DEFAULT_CATEGORIES.flatMap((c) => (c.systemKey ? [c.systemKey] : [])).sort();
    expect(keys).toEqual([
      "bank_fees",
      "card_payment",
      "internal_transfer",
      "salary",
      "uncategorized",
    ]);
    const fees = bySystemKey("bank_fees")!;
    const parent = DEFAULT_CATEGORIES.find((c) => c.key === fees.parentKey)!;
    expect(fees.name).toBe("Tarifas bancárias");
    expect(parent.name).toBe("Impostos, tarifas e juros");
    expect(bySystemKey("salary")).toMatchObject({
      name: "Salário",
      parentKey: null,
      kind: "income",
    });
  });

  it("só Transferência entre contas e Pagamento de fatura são neutras de sistema", () => {
    const neutralSystem = DEFAULT_CATEGORIES.filter((c) => c.kind === "neutral" && c.systemKey);
    expect(neutralSystem.map((c) => c.systemKey).sort()).toEqual([
      "card_payment",
      "internal_transfer",
    ]);
    expect(top.find((c) => c.name === "Investimentos")).toMatchObject({
      kind: "neutral",
      systemKey: null,
    });
  });

  it("subcategorias herdam o tipo do pai e há no máximo 2 níveis", () => {
    for (const child of sub) {
      const parent = DEFAULT_CATEGORIES.find((c) => c.key === child.parentKey);
      expect(parent?.parentKey, child.key).toBeNull();
      expect(child.kind, child.key).toBe(parent?.kind);
    }
  });

  it("nomes únicos entre irmãs (sem acento/caixa) e chaves únicas", () => {
    const siblings = new Set(DEFAULT_CATEGORIES.map((c) => `${c.parentKey}|${nameKey(c.name)}`));
    expect(siblings.size).toBe(DEFAULT_CATEGORIES.length);
    expect(new Set(DEFAULT_CATEGORIES.map((c) => c.key)).size).toBe(DEFAULT_CATEGORIES.length);
    for (const c of DEFAULT_CATEGORIES) {
      expect(c.name.length).toBeLessThanOrEqual(60);
      expect(c.key.length).toBeLessThanOrEqual(60);
    }
  });
});
