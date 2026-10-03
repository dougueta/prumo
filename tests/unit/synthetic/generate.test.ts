import { describe, expect, it } from "vitest";
import { generateDataset, type SyntheticTransaction } from "@/synthetic/generate";

const params = { seed: 42, months: 12, anchorDate: "2026-09-30" };
const data = generateDataset(params);
const tx = data.transactions;

function monthIndex(date: string) {
  const [year, month] = date.split("-").map(Number);
  return year * 12 + month;
}

describe("generateDataset (FR-014, FR-015, FR-018, data-model §5)", () => {
  it("é idêntico byte a byte para a mesma semente", () => {
    expect(JSON.stringify(generateDataset(params))).toBe(JSON.stringify(data));
  });

  it("muda com outra semente", () => {
    expect(JSON.stringify(generateDataset({ ...params, seed: 7 }))).not.toBe(JSON.stringify(data));
  });

  it("declara-se sintético e registra os parâmetros", () => {
    expect(data).toMatchObject({ schemaVersion: 1, synthetic: true, seed: 42, months: 12 });
    expect(tx.every((t) => t.synthetic === true)).toBe(true);
  });

  it("tem o perfil de contas esperado", () => {
    expect(data.accounts.filter((a) => a.receivesSalary)).toHaveLength(2);
    expect(data.accounts.filter((a) => a.type === "wallet")).toHaveLength(1);
    expect(data.accounts.filter((a) => a.type === "credit_card")).toHaveLength(2);
    expect(data.institutions.every((i) => /\(simulad[oa]\)/.test(i.name))).toBe(true);
  });

  it("cobre 12 meses terminando na data âncora", () => {
    const dates = tx.map((t) => t.date).sort();
    expect(dates[0] >= "2025-10-01").toBe(true);
    expect(dates[dates.length - 1] <= "2026-09-30").toBe(true);
    expect(new Set(dates.map((d) => d.slice(0, 7))).size).toBe(12);
  });

  it("usa apenas inteiros em centavos, nunca zero", () => {
    expect(tx.every((t) => Number.isInteger(t.amountCents) && t.amountCents !== 0)).toBe(true);
    for (const account of data.accounts) {
      if (account.creditLimitCents !== undefined) {
        expect(Number.isInteger(account.creditLimitCents)).toBe(true);
      }
    }
  });

  it("tem ids únicos e determinísticos", () => {
    expect(new Set(tx.map((t) => t.id)).size).toBe(tx.length);
    expect(tx[0].id).toBe("42-1");
  });

  it("toda transação referencia conta existente", () => {
    const ids = new Set(data.accounts.map((a) => a.id));
    expect(tx.every((t) => ids.has(t.accountId))).toBe(true);
  });

  it("transferências e pagamentos de fatura têm 2 pernas de soma zero", () => {
    const groups = new Map<string, number[]>();
    for (const t of tx) {
      if (!t.transferGroupId) continue;
      groups.set(t.transferGroupId, [...(groups.get(t.transferGroupId) ?? []), t.amountCents]);
    }
    expect(groups.size).toBeGreaterThan(0);
    for (const legs of groups.values()) {
      expect(legs).toHaveLength(2);
      expect(legs[0] + legs[1]).toBe(0);
    }
    expect(tx.some((t) => t.kind === "transfer_internal")).toBe(true);
    expect(tx.some((t) => t.kind === "card_bill_payment")).toBe(true);
  });

  it("parcelas são 1..n em meses consecutivos", () => {
    const groups = new Map<string, SyntheticTransaction[]>();
    for (const t of tx) {
      if (!t.installment) continue;
      groups.set(t.installment.groupId, [...(groups.get(t.installment.groupId) ?? []), t]);
    }
    expect(groups.size).toBeGreaterThanOrEqual(3);
    for (const items of groups.values()) {
      const sorted = [...items].sort((a, b) => a.installment!.number - b.installment!.number);
      expect(sorted.map((t) => t.installment!.number)).toEqual(
        Array.from({ length: sorted.length }, (_, i) => i + 1),
      );
      expect(sorted.length).toBeLessThanOrEqual(sorted[0].installment!.total);
      for (let i = 1; i < sorted.length; i++) {
        expect(monthIndex(sorted[i].date) - monthIndex(sorted[i - 1].date)).toBe(1);
      }
    }
  });

  it("tem as contagens mínimas do perfil", () => {
    const subscriptions = new Set(
      tx.filter((t) => t.kind === "subscription").map((t) => t.description),
    );
    expect(subscriptions.size).toBeGreaterThanOrEqual(5);
    expect(tx.filter((t) => t.kind === "refund").length).toBeGreaterThanOrEqual(1);
    const international = tx.filter((t) => t.kind === "international");
    expect(international.length).toBeGreaterThanOrEqual(1);
    expect(
      international.every(
        (t) => t.originalCurrency && Number.isInteger(t.originalCurrency.amountMinor),
      ),
    ).toBe(true);
    expect(tx.filter((t) => t.kind === "salary").length).toBeGreaterThanOrEqual(24);
  });

  it("não contém padrões de dados pessoais reais (CPF, cartão, e-mail)", () => {
    const text = JSON.stringify(data);
    expect(text).not.toMatch(/\d{3}\.\d{3}\.\d{3}-\d{2}/);
    expect(text).not.toMatch(/\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b/);
    expect(text).not.toMatch(/@[a-z0-9-]+\.[a-z]{2,}/i);
  });

  it("gera 12 meses em menos de 30 s (SC-006)", () => {
    const started = performance.now();
    generateDataset({ ...params, seed: 99 });
    expect(performance.now() - started).toBeLessThan(30_000);
  });

  it("rejeita menos de 12 meses", () => {
    expect(() => generateDataset({ ...params, months: 11 })).toThrow(/months/);
  });
});
