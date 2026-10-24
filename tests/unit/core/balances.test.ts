import { describe, expect, it } from "vitest";
import { computeBalances } from "@/domain/core/balances";
import type { Account, Transaction } from "@/domain/core/types";

// 004 · T039 — saldo calculado × informado (R-09; FR-010, FR-016).
function account(over: Partial<Account> = {}): Account {
  return {
    id: "acc",
    ownerId: "owner",
    institutionId: "inst",
    name: "Conta Fictícia",
    nickname: null,
    type: "checking",
    currency: "BRL",
    source: "manual",
    externalId: null,
    last4: null,
    creditLimitCents: null,
    closingDay: null,
    dueDay: null,
    openingBalanceCents: 0,
    openingBalanceOn: null,
    reportedBalanceCents: null,
    reportedBalanceOn: null,
    archivedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

let seq = 0;
function tx(bookedOn: string, amountCents: number, over: Partial<Transaction> = {}): Transaction {
  return {
    id: `t${++seq}`,
    ownerId: "owner",
    accountId: "acc",
    batchId: null,
    source: "manual",
    externalId: null,
    identityKey: `man:${seq}`,
    amountCents,
    bookedOn,
    occurredAt: null,
    descriptionOriginal: "",
    description: null,
    merchant: null,
    status: "posted",
    nature: "regular",
    relatedTransactionId: null,
    categoryId: null,
    categorySource: null,
    categoryConfidence: null,
    notes: null,
    installment: null,
    original: null,
    lockedFields: [],
    deletedAt: null,
    deletedReason: null,
    mergedIntoId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

describe("computeBalances", () => {
  it("soma só posted não excluídas dentro de opening_on..asOf, a partir do saldo inicial", () => {
    const a = account({ openingBalanceCents: 10_000, openingBalanceOn: "2026-09-01" });
    const txs = [
      tx("2026-08-31", -999), // antes do saldo inicial
      tx("2026-09-05", -1_000),
      tx("2026-09-10", 500),
      tx("2026-09-11", -300, { status: "pending" }),
      tx("2026-09-12", -200, { deletedAt: "x", deletedReason: "user" }),
      tx("2026-10-01", -50), // depois de asOf
      tx("2026-09-06", -7, { accountId: "outra" }),
    ];
    const [balance] = computeBalances([a], txs, "2026-09-30");
    expect(balance).toEqual({
      accountId: "acc",
      reportedCents: null,
      reportedOn: null,
      computedCents: 9_500,
      computedAtReportedCents: null,
      divergenceCents: null,
    });
  });

  it("divergência = informado − calculado na data informada", () => {
    const a = account({ reportedBalanceCents: 9_000, reportedBalanceOn: "2026-09-05" });
    const [balance] = computeBalances(
      [a],
      [tx("2026-09-05", -1_000), tx("2026-09-20", 3_000)],
      "2026-09-30",
    );
    expect(balance).toMatchObject({
      computedCents: 2_000,
      computedAtReportedCents: -1_000,
      divergenceCents: 10_000,
    });
  });

  it("cartão: compras negativas e pagamento positivo somam no sinal da conta", () => {
    const card = account({ type: "credit_card" });
    const [balance] = computeBalances(
      [card],
      [
        tx("2026-09-02", -12_000),
        tx("2026-09-03", -3_000),
        tx("2026-09-10", 15_000, { nature: "card_payment" }),
      ],
      "2026-09-30",
    );
    expect(balance.computedCents).toBe(0);
  });

  it("sem contas ⇒ lista vazia", () => {
    expect(computeBalances([], [], "2026-09-30")).toEqual([]);
  });
});
