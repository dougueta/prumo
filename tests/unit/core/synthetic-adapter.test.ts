import { describe, expect, it } from "vitest";
import { DEMO_OWNER_ID } from "@/data/core";
import { fromSyntheticDataset } from "@/data/core/synthetic-adapter";
import { generateDataset } from "@/synthetic/generate";

// 004 · T051 — adaptador do SyntheticDataset v1 (data-model §7; FR-047, SC-006).
const ds = generateDataset({ seed: 42, months: 12, anchorDate: "2026-09-30" });
const data = fromSyntheticDataset(ds, DEMO_OWNER_ID);
const UUID_V5 = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const sumByMonth = (rows: { date: string; cents: number }[]) => {
  const out: Record<string, number> = {};
  for (const r of rows) out[r.date.slice(0, 7)] = (out[r.date.slice(0, 7)] ?? 0) + r.cents;
  return out;
};

describe("fromSyntheticDataset", () => {
  it("mapeia 5 contas, instituições e 1 lote ofx concluído por conta", () => {
    expect(data.accounts).toHaveLength(5);
    expect(data.institutions).toHaveLength(ds.institutions.length);
    expect(data.batches).toHaveLength(5);
    for (const batch of data.batches) {
      expect(batch).toMatchObject({ source: "ofx", status: "completed", initiatedBy: "system" });
      expect(data.accounts.some((a) => a.id === batch.accountId)).toBe(true);
    }
    const types = data.accounts.map((a) => a.type).sort();
    expect(types).toEqual(["checking", "checking", "credit_card", "credit_card", "digital_wallet"]);
    const card = data.accounts.find((a) => a.name === "Cartão Órbita (simulado)")!;
    expect(card).toMatchObject({
      source: "manual",
      creditLimitCents: 1_500_000,
      closingDay: 3,
      dueDay: 10,
    });
    expect(data.institutions.find((i) => i.name === "Carteira Pix (simulada)")!.kind).toBe(
      "digital_wallet",
    );
    expect([...data.accounts, ...data.institutions].every((x) => x.ownerId === DEMO_OWNER_ID)).toBe(
      true,
    );
  });

  it("UUIDs v5 determinísticos (mesma semente ⇒ mesmos ids)", () => {
    const again = fromSyntheticDataset(ds, DEMO_OWNER_ID);
    expect(again.transactions.map((t) => t.id)).toEqual(data.transactions.map((t) => t.id));
    for (const id of [...data.accounts.map((a) => a.id), ...data.transactions.map((t) => t.id)]) {
      expect(id).toMatch(UUID_V5);
    }
    expect(new Set(data.transactions.map((t) => t.id)).size).toBe(ds.transactions.length);
  });

  it("Σ centavos igual ao dataset no total e por mês (SC-006)", () => {
    const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
    expect(sum(data.transactions.map((t) => t.amountCents))).toBe(
      sum(ds.transactions.map((t) => t.amountCents)),
    );
    expect(
      sumByMonth(data.transactions.map((t) => ({ date: t.bookedOn, cents: t.amountCents }))),
    ).toEqual(sumByMonth(ds.transactions.map((t) => ({ date: t.date, cents: t.amountCents }))));
  });

  it("transações: ofx, ext:<id>, posted, ligadas ao lote da conta", () => {
    for (const tx of data.transactions) {
      expect(tx.source).toBe("ofx");
      expect(tx.identityKey).toBe(`ext:${tx.externalId}`);
      expect(tx.status).toBe("posted");
      expect(data.batches.find((b) => b.id === tx.batchId)!.accountId).toBe(tx.accountId);
    }
  });

  it("pares de transferência/pagamento ligados por relatedTransactionId com a natureza certa", () => {
    const groups = new Map<string, string[]>();
    for (const t of ds.transactions) {
      if (t.transferGroupId)
        groups.set(t.transferGroupId, [...(groups.get(t.transferGroupId) ?? []), t.id]);
    }
    const byExternal = new Map(data.transactions.map((t) => [t.externalId, t]));
    for (const [a, b] of groups.values()) {
      const legA = byExternal.get(a)!;
      const legB = byExternal.get(b)!;
      expect(legA.relatedTransactionId).toBe(legB.id);
      expect(legB.relatedTransactionId).toBe(legA.id);
      expect(["internal_transfer", "card_payment"]).toContain(legA.nature);
      expect(legA.categoryKey).toBe(legA.nature);
    }
  });

  it("parcelas e moeda original preservadas; categorias conforme o data-model §7", () => {
    const byExternal = new Map(data.transactions.map((t) => [t.externalId, t]));
    const expectedKey: Record<string, string | null> = {
      salary: "salary.salary",
      subscription: "subscriptions.streaming",
      fee: "taxes_fees.bank_fees",
      income_other: "other_income.misc",
      refund: "refunds.chargebacks",
      purchase: null,
      installment: null,
      international: null,
    };
    for (const source of ds.transactions) {
      const tx = byExternal.get(source.id)!;
      if (source.installment) {
        expect(tx.installment).toEqual({
          number: source.installment.number,
          total: source.installment.total,
          group: source.installment.groupId,
        });
      }
      if (source.originalCurrency) {
        expect(tx.original).toEqual({
          currency: source.originalCurrency.code,
          amountMinor: source.originalCurrency.amountMinor,
        });
      }
      if (source.kind in expectedKey) {
        expect(tx.categoryKey, source.kind).toBe(expectedKey[source.kind]);
        expect(tx.categorySource).toBe(expectedKey[source.kind] ? "source" : null);
      }
      if (source.kind === "refund") expect(tx.nature).toBe("refund");
    }
  });
});
