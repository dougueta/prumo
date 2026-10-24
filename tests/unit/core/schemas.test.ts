import { describe, expect, it } from "vitest";
import {
  accountInputSchema,
  accountPatchSchema,
  categoryPatchSchema,
  incomingTxSchema,
  manualTxInputSchema,
  newBatchSchema,
  newCategorySchema,
  newInstitutionSchema,
  txPatchSchema,
  txQuerySchema,
} from "@/domain/core/schemas";

// 004 · T067 — limites iguais aos CHECK do data-model (FR-013, FR-015, FR-018).
const UUID = "6f1c1f0e-0d51-4a43-9a0c-4c4a3a4b7d10";
type Schema = { safeParse(v: unknown): { success: boolean } };
const ok = (schema: Schema, value: unknown) => expect(schema.safeParse(value).success).toBe(true);
const bad = (schema: Schema, value: unknown) => expect(schema.safeParse(value).success).toBe(false);

const tx = {
  accountId: UUID,
  source: "csv",
  amountCents: -800,
  bookedOn: "2026-09-12",
  descriptionOriginal: "CAFE FICTICIO",
  status: "posted",
};

describe("IncomingTx", () => {
  it("aceita linha mínima, valor zero, data futura e descrição vazia", () => {
    ok(incomingTxSchema, tx);
    ok(incomingTxSchema, { ...tx, amountCents: 0 });
    ok(incomingTxSchema, { ...tx, bookedOn: "2030-01-10" });
    ok(incomingTxSchema, { ...tx, descriptionOriginal: "" });
  });

  it("aplica limites de texto, parcela, moeda e confiança", () => {
    bad(incomingTxSchema, { ...tx, descriptionOriginal: "x".repeat(501) });
    ok(incomingTxSchema, { ...tx, descriptionOriginal: "x".repeat(500) });
    bad(incomingTxSchema, { ...tx, merchant: "x".repeat(201) });
    bad(incomingTxSchema, { ...tx, externalId: "x".repeat(141) });
    bad(incomingTxSchema, { ...tx, externalId: "   " });
    ok(incomingTxSchema, { ...tx, installment: { number: 3, total: 10, group: "g" } });
    bad(incomingTxSchema, { ...tx, installment: { number: 4, total: 3, group: "g" } });
    bad(incomingTxSchema, { ...tx, installment: { number: 1, total: 421, group: "g" } });
    bad(incomingTxSchema, { ...tx, installment: { number: 0, total: 3, group: "g" } });
    ok(incomingTxSchema, { ...tx, original: { currency: "USD", amountMinor: 2000 } });
    bad(incomingTxSchema, { ...tx, original: { currency: "BRL", amountMinor: 2000 } });
    bad(incomingTxSchema, { ...tx, original: { currency: "usd", amountMinor: 2000 } });
    ok(incomingTxSchema, { ...tx, category: { id: UUID, source: "ai", confidence: 87 } });
    bad(incomingTxSchema, { ...tx, category: { id: UUID, source: "ai", confidence: 101 } });
    bad(incomingTxSchema, { ...tx, category: { id: UUID, source: "ai", confidence: 50.5 } });
    bad(incomingTxSchema, { ...tx, category: { id: UUID, source: "manual" } });
  });

  it("recusa fração de centavo, data inválida e origem manual", () => {
    bad(incomingTxSchema, { ...tx, amountCents: 1.5 });
    bad(incomingTxSchema, { ...tx, amountCents: "800" });
    bad(incomingTxSchema, { ...tx, bookedOn: "2026-02-30" });
    bad(incomingTxSchema, { ...tx, bookedOn: "1899-12-31" });
    bad(incomingTxSchema, { ...tx, source: "manual" });
    bad(incomingTxSchema, { ...tx, occurredAt: "2026-09-12 10:00" });
    ok(incomingTxSchema, { ...tx, occurredAt: "2026-09-12T10:00:00-03:00" });
  });
});

describe("ManualTxInput e TxPatch", () => {
  const manual = {
    accountId: UUID,
    amountCents: -1500,
    bookedOn: "2026-09-01",
    description: "Feira",
  };
  it("valida limites", () => {
    ok(manualTxInputSchema, manual);
    ok(manualTxInputSchema, { ...manual, notes: "n".repeat(2000), categoryId: null });
    bad(manualTxInputSchema, { ...manual, notes: "n".repeat(2001) });
    bad(manualTxInputSchema, { ...manual, description: "d".repeat(501) });
    bad(manualTxInputSchema, { ...manual, amountCents: 0.1 });
  });

  it("patch aceita nulos para limpar e recusa campos desconhecidos", () => {
    ok(txPatchSchema, { description: null, merchant: null, category: { id: null } });
    ok(txPatchSchema, { category: { id: UUID, confidence: 90 } });
    bad(txPatchSchema, { category: { id: UUID, confidence: -1 } });
    bad(txPatchSchema, { descriptionOriginal: "x" });
    bad(txPatchSchema, { notes: "n".repeat(2001) });
  });
});

describe("AccountInput e AccountPatch", () => {
  const account = {
    institutionId: UUID,
    name: "Cartão Caixa",
    type: "credit_card",
    source: "manual",
  };
  it("valida limites e exigências", () => {
    ok(accountInputSchema, { ...account, closingDay: 5, dueDay: 12, creditLimitCents: 500_000 });
    bad(accountInputSchema, { ...account, closingDay: 0 });
    bad(accountInputSchema, { ...account, dueDay: 32 });
    bad(accountInputSchema, { ...account, last4: "12345" });
    bad(accountInputSchema, { ...account, last4: "12a4" });
    ok(accountInputSchema, { ...account, last4: "1234" });
    bad(accountInputSchema, { ...account, name: "x".repeat(81) });
    bad(accountInputSchema, { ...account, name: "   " });
    bad(accountInputSchema, { ...account, nickname: "x".repeat(41) });
    bad(accountInputSchema, { ...account, source: "pluggy" });
    ok(accountInputSchema, { ...account, source: "pluggy", externalId: "acc-1" });
    bad(accountInputSchema, { ...account, type: "checking", dueDay: 12 });
    bad(accountInputSchema, { ...account, creditLimitCents: -1 });
    bad(accountInputSchema, {
      ...account,
      source: "pluggy",
      externalId: "a",
      openingBalanceCents: 10,
    });
    ok(accountPatchSchema, { nickname: "Roxinho", dueDay: 10 });
    bad(accountPatchSchema, { currency: "USD" });
  });
});

describe("Instituições, categorias, lotes e consultas", () => {
  it("valida limites", () => {
    ok(newInstitutionSchema, { name: "Banco Fictício", kind: "bank", bankCode: "999" });
    bad(newInstitutionSchema, { name: "x".repeat(121), kind: "bank" });
    bad(newInstitutionSchema, { name: "B", kind: "bank", bankCode: "12" });
    ok(newCategorySchema, { name: "Feira", parentId: UUID });
    ok(newCategorySchema, { name: "Feira", kind: "expense" });
    bad(newCategorySchema, { name: "Feira" });
    bad(newCategorySchema, { name: "x".repeat(61), kind: "expense" });
    ok(categoryPatchSchema, { name: "Comida", hidden: true, parentId: null });
    ok(newBatchSchema, { source: "csv", initiatedBy: "user", fileSha256: "a".repeat(64) });
    bad(newBatchSchema, { source: "csv", initiatedBy: "user", fileSha256: "A".repeat(64) });
    bad(newBatchSchema, { source: "csv", initiatedBy: "user", fileName: "f".repeat(256) });
    bad(newBatchSchema, {
      source: "csv",
      initiatedBy: "user",
      periodStart: "2026-09-30",
      periodEnd: "2026-09-01",
    });
    ok(txQuerySchema, {});
    ok(txQuerySchema, { limit: 200, from: "2026-09-01", to: "2026-09-30" });
    bad(txQuerySchema, { limit: 201 });
    bad(txQuerySchema, { limit: 0 });
    bad(txQuerySchema, { from: "2026-09-31" });
  });
});
