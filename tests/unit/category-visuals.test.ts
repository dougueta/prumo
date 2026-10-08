import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import * as lucide from "lucide-react";
import { describe, expect, it } from "vitest";
import {
  CATEGORY_COLORS,
  CATEGORY_VISUALS,
  categoryVisual,
  slugifyCategoryName,
} from "@/components/finance/category-visuals";
import { institutionInitials } from "@/components/finance/institution-avatar";

/** data-model §1.4 e §5 — FR-036. Mapa fixo de ícone/cor por categoria de 1º nível (dona: 003). */

// Taxonomia de 1º nível da 004 (data-model §4 da 004). Quando a 004 estiver integrada, o teste lê
// a fonte única src/domain/core/default-categories.ts; até lá, usa esta cópia do contrato.
const FALLBACK_TOP_LEVEL: [key: string, name: string][] = [
  ["food", "Alimentação"],
  ["housing", "Moradia"],
  ["transport", "Transporte"],
  ["health", "Saúde"],
  ["education", "Educação"],
  ["leisure", "Lazer"],
  ["travel", "Viagens"],
  ["shopping", "Compras"],
  ["subscriptions", "Assinaturas e serviços"],
  ["personal_care", "Cuidados pessoais"],
  ["pets", "Pets"],
  ["family", "Família e filhos"],
  ["taxes_fees", "Impostos, tarifas e juros"],
  ["donations", "Doações"],
  ["other_expenses", "Outros gastos"],
  ["salary", "Salário"],
  ["extra_income", "Renda extra"],
  ["yields", "Rendimentos"],
  ["refunds", "Reembolsos"],
  ["other_income", "Outras receitas"],
  ["internal_transfer", "Transferência entre contas"],
  ["card_payment", "Pagamento de fatura"],
  ["investments", "Investimentos"],
  ["uncategorized", "Sem categoria"],
];

function topLevelCategories(): [string, string][] {
  const file = path.resolve(__dirname, "../../src/domain/core/default-categories.ts");
  if (!existsSync(file)) return FALLBACK_TOP_LEVEL;
  const source = readFileSync(file, "utf8");
  // Entradas de 1º nível têm `key` e `name` como propriedades; filhos são tuplas.
  return [...source.matchAll(/key: "([a-z_]+)",\s*name: "([^"]+)"/g)].map((m) => [m[1], m[2]]);
}

const TOP = topLevelCategories();

describe("CATEGORY_VISUALS", () => {
  it("24 categorias de 1º nível + sem-categoria + personalizada", () => {
    expect(TOP).toHaveLength(24);
    expect(Object.keys(CATEGORY_VISUALS)).toHaveLength(25);
    expect(CATEGORY_VISUALS).toHaveProperty("sem-categoria");
    expect(CATEGORY_VISUALS).toHaveProperty("personalizada");
  });

  it("nenhuma categoria de 1º nível fica sem chave (por nome e pela chave da 004)", () => {
    const missing = TOP.filter(
      ([key, name]) =>
        !(slugifyCategoryName(name) in CATEGORY_VISUALS) ||
        categoryVisual({ slug: key }) === "personalizada",
    );
    expect(missing).toEqual([]);
  });

  it("todo ícone existe no lucide-react e toda cor é de categoria", () => {
    for (const [key, visual] of Object.entries(CATEGORY_VISUALS)) {
      expect(lucide, key).toHaveProperty(visual.icon);
      expect(CATEGORY_COLORS, key).toContain(visual.color);
    }
  });

  it("resolução: systemKey, slug, desconhecido e sem categoria", () => {
    expect(categoryVisual({ systemKey: "salary" })).toBe("salario");
    expect(categoryVisual({ systemKey: "internal_transfer" })).toBe("transferencia-entre-contas");
    expect(categoryVisual({ systemKey: "card_payment" })).toBe("pagamento-de-fatura");
    expect(categoryVisual({ systemKey: "uncategorized" })).toBe("sem-categoria");
    expect(categoryVisual({ systemKey: "bank_fees" })).toBe("impostos-tarifas-e-juros");
    expect(categoryVisual({ slug: "alimentacao" })).toBe("alimentacao");
    expect(categoryVisual({ slug: "food" })).toBe("alimentacao");
    expect(categoryVisual({ slug: "minha-categoria" })).toBe("personalizada");
    expect(categoryVisual(null)).toBe("sem-categoria");
  });

  it("valores do mapa (data-model §1.4)", () => {
    expect(CATEGORY_VISUALS.alimentacao).toEqual({ icon: "UtensilsCrossed", color: "terracota" });
    expect(CATEGORY_VISUALS.salario).toEqual({ icon: "Briefcase", color: "verde" });
    expect(CATEGORY_VISUALS.personalizada).toEqual({ icon: "Tag", color: "cinza" });
  });
});

describe("institutionInitials", () => {
  it.each([
    ["Banco Aurora (simulado)", "AU"],
    ["Carteira Pix (simulada)", "CP"],
    ["Banco do Horizonte Digital", "HD"],
    ["Órbita", "ÓR"],
    ["Banco", "?"],
    ["", "?"],
  ])("%j → %s", (name, initials) => {
    expect(institutionInitials(name)).toBe(initials);
  });
});
