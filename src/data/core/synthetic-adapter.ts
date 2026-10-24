import { createHash } from "node:crypto";
import type {
  Account,
  AccountType,
  ImportBatch,
  Institution,
  OwnerId,
  Transaction,
  TxNature,
} from "@/domain/core/types";
import type { SyntheticDataset, TransactionKind } from "@/synthetic/generate";

/**
 * Adaptação do SyntheticDataset v1 (feature 001) ao modelo core — data-model §7 (FR-047).
 * Saída em objetos de domínio com UUIDs v5 determinísticos; a categoria vai como chave de modelo
 * (`categoryKey`), resolvida para o id da categoria do dono por quem carrega os dados.
 */

export type SyntheticTx = Omit<Transaction, "categoryId"> & { categoryKey: string | null };
export type SyntheticCoreData = {
  institutions: Institution[];
  accounts: Account[];
  batches: ImportBatch[];
  transactions: SyntheticTx[];
};

/** Namespace fixo do Prumo para UUIDs v5 dos dados sintéticos. */
const NAMESPACE = "2f0b8d0e-6a55-4c1e-9d1a-7b3c5e9f0a11";

/** UUID v5 (RFC 4122, SHA-1) — determinístico para o mesmo nome. */
export function uuidV5(name: string, namespace = NAMESPACE): string {
  const ns = Buffer.from(namespace.replaceAll("-", ""), "hex");
  const hash = createHash("sha1").update(ns).update(name, "utf8").digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

const ACCOUNT_TYPE: Record<string, AccountType> = {
  checking: "checking",
  wallet: "digital_wallet",
  credit_card: "credit_card",
};

const NATURE: Partial<Record<TransactionKind, TxNature>> = {
  transfer_internal: "internal_transfer",
  card_bill_payment: "card_payment",
  refund: "refund",
};

const CATEGORY: Record<TransactionKind, string | null> = {
  transfer_internal: "internal_transfer",
  card_bill_payment: "card_payment",
  refund: "refunds.chargebacks",
  salary: "salary.salary",
  subscription: "subscriptions.streaming",
  fee: "taxes_fees.bank_fees",
  income_other: "other_income.misc",
  purchase: null,
  installment: null,
  international: null,
};

export function fromSyntheticDataset(ds: SyntheticDataset, ownerId: OwnerId): SyntheticCoreData {
  const at = `${ds.anchorDate}T12:00:00.000Z`;
  const id = (kind: string, syntheticId: string) => uuidV5(`${kind}:${ds.seed}:${syntheticId}`);

  const institutions: Institution[] = ds.institutions.map((i) => ({
    id: id("institution", i.id),
    ownerId,
    name: i.name,
    kind: i.kind === "wallet" ? "digital_wallet" : "bank",
    bankCode: null,
    externalRef: null,
    createdAt: at,
    updatedAt: at,
  }));

  const accounts: Account[] = ds.accounts.map((a) => ({
    id: id("account", a.id),
    ownerId,
    institutionId: id("institution", a.institutionId),
    name: a.name,
    nickname: null,
    type: ACCOUNT_TYPE[a.type],
    currency: "BRL",
    source: "manual",
    externalId: null,
    last4: null,
    creditLimitCents: a.creditLimitCents ?? null,
    closingDay: a.closingDay ?? null,
    dueDay: a.dueDay ?? null,
    openingBalanceCents: 0,
    openingBalanceOn: null,
    reportedBalanceCents: null,
    reportedBalanceOn: null,
    archivedAt: null,
    createdAt: at,
    updatedAt: at,
  }));

  const batches: ImportBatch[] = accounts.map((account, index) => {
    const count = ds.transactions.filter((t) => t.accountId === ds.accounts[index].id).length;
    return {
      id: id("batch", ds.accounts[index].id),
      ownerId,
      source: "ofx",
      accountId: account.id,
      initiatedBy: "system",
      fileName: null,
      fileSha256: null,
      periodStart: null,
      periodEnd: null,
      status: "completed",
      counts: {
        read: count,
        created: count,
        updated: 0,
        restored: 0,
        duplicate: 0,
        protected: 0,
        rejected: 0,
      },
      errorSummary: null,
      startedAt: at,
      finishedAt: at,
    };
  });

  const legs = new Map<string, string[]>();
  for (const t of ds.transactions) {
    if (t.transferGroupId)
      legs.set(t.transferGroupId, [...(legs.get(t.transferGroupId) ?? []), t.id]);
  }

  const transactions: SyntheticTx[] = ds.transactions.map((t) => {
    const categoryKey = CATEGORY[t.kind];
    const partner = t.transferGroupId
      ? legs.get(t.transferGroupId)!.find((other) => other !== t.id)
      : undefined;
    return {
      id: id("tx", t.id),
      ownerId,
      accountId: id("account", t.accountId),
      batchId: id("batch", t.accountId),
      source: "ofx",
      externalId: t.id,
      identityKey: `ext:${t.id}`,
      amountCents: t.amountCents,
      bookedOn: t.date,
      occurredAt: null,
      descriptionOriginal: t.description,
      description: null,
      merchant: null,
      status: "posted",
      nature: NATURE[t.kind] ?? "regular",
      relatedTransactionId: partner ? id("tx", partner) : null,
      categoryKey,
      categorySource: categoryKey ? "source" : null,
      categoryConfidence: null,
      notes: null,
      installment: t.installment
        ? { number: t.installment.number, total: t.installment.total, group: t.installment.groupId }
        : null,
      original: t.originalCurrency
        ? { currency: t.originalCurrency.code, amountMinor: t.originalCurrency.amountMinor }
        : null,
      lockedFields: [],
      deletedAt: null,
      deletedReason: null,
      mergedIntoId: null,
      createdAt: at,
      updatedAt: at,
    };
  });

  return { institutions, accounts, batches, transactions };
}
