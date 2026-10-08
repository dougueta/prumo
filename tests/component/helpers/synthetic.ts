import { generateDataset, type TransactionKind } from "@/synthetic/generate";

/** Dados sintéticos (seed 42) para testes de componentes — Constitution II: nada escrito à mão. */
export const DATASET = generateDataset({ seed: 42, months: 12, anchorDate: "2026-09-30" });

export function firstOfKind(kind: TransactionKind) {
  const tx = DATASET.transactions.find((t) => t.kind === kind);
  if (!tx) throw new Error(`Sem transação sintética do tipo ${kind}`);
  const account = DATASET.accounts.find((a) => a.id === tx.accountId);
  const institution = DATASET.institutions.find((i) => i.id === account?.institutionId);
  if (!account || !institution) throw new Error("Conta sintética inconsistente");
  return { tx, account, institution };
}
