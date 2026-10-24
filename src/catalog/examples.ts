import type { CategoryVisualKey } from "@/components/finance/category-visuals";
import type { SourceBadgeData } from "@/components/finance/source-badge";
import type { TransactionItemData } from "@/components/finance/transaction-item";
import { addDays } from "@/lib/format";
import {
  generateDataset,
  type SyntheticDataset,
  type SyntheticTransaction,
} from "@/synthetic/generate";

/**
 * Exemplos do catálogo (data-model §7, contracts/catalog.md §4): view models derivados do
 * gerador sintético da 001 (seed 42) por regras determinísticas — nada digitado à mão
 * (Constitution II). Categoria, status, natureza e categorização, que o gerador não tem,
 * vêm do `kind` e de um hash estável do `id`.
 */
export const CATALOG_TODAY = "2026-09-30";
const PARAMS = { seed: 42, months: 12, anchorDate: CATALOG_TODAY } as const;

/** FNV-1a 32 bits (hash estável, sem dependência). */
export function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Rótulos de 1º nível da taxonomia da 004 (data-model §4 da 004) usados nos exemplos. */
const CATEGORY_NAMES: Partial<Record<CategoryVisualKey, string>> = {
  alimentacao: "Alimentação",
  transporte: "Transporte",
  compras: "Compras",
  lazer: "Lazer",
  saude: "Saúde",
  salario: "Salário",
  "assinaturas-e-servicos": "Assinaturas e serviços",
  "transferencia-entre-contas": "Transferência entre contas",
  "pagamento-de-fatura": "Pagamento de fatura",
  reembolsos: "Reembolsos",
  viagens: "Viagens",
  "impostos-tarifas-e-juros": "Impostos, tarifas e juros",
  "outras-receitas": "Outras receitas",
};

type Derived = {
  visual: CategoryVisualKey | null;
  categorization: SourceBadgeData;
  nature: NonNullable<TransactionItemData["nature"]>;
};

function purchaseVisual(h: number): CategoryVisualKey | null {
  if (h % 13 === 0) return null;
  if (h < 30) return "alimentacao";
  if (h < 50) return "transporte";
  if (h < 70) return "compras";
  if (h < 85) return "lazer";
  return "saude";
}

function derive(tx: SyntheticTransaction): Derived {
  const h = fnv1a(tx.id) % 100;
  switch (tx.kind) {
    case "salary":
      return { visual: "salario", categorization: { origin: "source" }, nature: "regular" };
    case "purchase":
      return {
        visual: purchaseVisual(h),
        categorization: {
          origin: "ai",
          confidence: h < 60 ? "high" : h < 85 ? "medium" : "low",
        },
        nature: "regular",
      };
    case "subscription":
      return {
        visual: "assinaturas-e-servicos",
        categorization: { origin: "rule" },
        nature: "regular",
      };
    case "installment":
      return {
        visual: "compras",
        categorization: { origin: "ai", confidence: "high" },
        nature: "regular",
      };
    case "transfer_internal":
      return {
        visual: "transferencia-entre-contas",
        categorization: { origin: "rule" },
        nature: "internal_transfer",
      };
    case "card_bill_payment":
      return {
        visual: "pagamento-de-fatura",
        categorization: { origin: "rule" },
        nature: "card_payment",
      };
    case "refund":
      return { visual: "reembolsos", categorization: { origin: "source" }, nature: "refund" };
    case "international":
      return {
        visual: "viagens",
        categorization: { origin: "ai", confidence: "medium" },
        nature: "regular",
      };
    case "fee":
      return {
        visual: "impostos-tarifas-e-juros",
        categorization: { origin: "source" },
        nature: "regular",
      };
    case "income_other":
      return { visual: "outras-receitas", categorization: { origin: "manual" }, nature: "regular" };
  }
}

export type CatalogExamples = {
  dataset: SyntheticDataset;
  /** Todas as transações, mais recentes primeiro. */
  transactions: TransactionItemData[];
};

/** Constrói os exemplos do zero (sem memória) — usado no teste de determinismo. */
export function buildCatalogExamples(): CatalogExamples {
  const dataset = generateDataset(PARAMS);
  const pendingFrom = addDays(dataset.anchorDate, -1);
  const transactions = dataset.transactions
    .map((tx): TransactionItemData => {
      const account = dataset.accounts.find((a) => a.id === tx.accountId);
      const institution = dataset.institutions.find((i) => i.id === account?.institutionId);
      const { visual, categorization, nature } = derive(tx);
      return {
        id: tx.id,
        description: tx.description,
        amountCents: tx.amountCents,
        date: tx.date,
        category: visual ? { name: CATEGORY_NAMES[visual] ?? visual, visual } : null,
        account: { name: account?.name ?? "", institutionName: institution?.name ?? "" },
        status: tx.date >= pendingFrom ? "pending" : "posted",
        ...(tx.installment
          ? { installment: { number: tx.installment.number, total: tx.installment.total } }
          : {}),
        nature,
        ...(tx.originalCurrency
          ? {
              original: {
                amountMinor: tx.originalCurrency.amountMinor,
                currency: tx.originalCurrency.code,
              },
            }
          : {}),
        categorization,
      };
    })
    .sort((a, b) => (a.date === b.date ? a.id.localeCompare(b.id) : b.date.localeCompare(a.date)));
  return { dataset, transactions };
}

let cached: CatalogExamples | undefined;

/** Exemplos memoizados no módulo (contracts/catalog.md §4). */
export function catalogExamples(): CatalogExamples {
  cached ??= buildCatalogExamples();
  return cached;
}

export function catalogDataset(): SyntheticDataset {
  return catalogExamples().dataset;
}

/** Primeira transação que satisfaz o critério (lança se o dataset não tiver nenhuma). */
export function pick(predicate: (item: TransactionItemData) => boolean): TransactionItemData {
  const found = catalogExamples().transactions.find(predicate);
  if (!found) throw new Error("Nenhum exemplo sintético para este critério");
  return found;
}

/** Transações de um dia, para listas agrupadas. */
export function transactionsOn(date: string): TransactionItemData[] {
  return catalogExamples().transactions.filter((item) => item.date === date);
}

/** Datas mais recentes com transações. */
export function recentDates(count: number): string[] {
  return [...new Set(catalogExamples().transactions.map((item) => item.date))].slice(0, count);
}

/** Soma exata em centavos (inteiros). */
export function sumCents(items: TransactionItemData[]): number {
  return items.reduce((total, item) => total + item.amountCents, 0);
}
