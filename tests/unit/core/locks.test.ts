import { describe, expect, it } from "vitest";
import { applyPatch } from "@/domain/core/locks";
import type { Transaction } from "@/domain/core/types";

// 004 · T028 — applyPatch: travas por campo e fatos imutáveis (FR-020, FR-024, FR-026).
const CAT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CAT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const UNCATEGORIZED = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function tx(over: Partial<Transaction> = {}): Transaction {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    ownerId: "22222222-2222-4222-8222-222222222222",
    accountId: "33333333-3333-4333-8333-333333333333",
    batchId: "44444444-4444-4444-8444-444444444444",
    source: "pluggy",
    externalId: "P1",
    identityKey: "ext:P1",
    amountCents: -5000,
    bookedOn: "2026-09-10",
    occurredAt: null,
    descriptionOriginal: "PAG*JOSEDASILVA",
    description: null,
    merchant: null,
    status: "posted",
    nature: "regular",
    relatedTransactionId: null,
    categoryId: CAT_A,
    categorySource: "ai",
    categoryConfidence: 70,
    notes: null,
    installment: null,
    original: null,
    lockedFields: [],
    deletedAt: null,
    deletedReason: null,
    mergedIntoId: null,
    createdAt: "2026-09-10T12:00:00.000Z",
    updatedAt: "2026-09-10T12:00:00.000Z",
    ...over,
  };
}

const lookups = { uncategorizedId: UNCATEGORIZED };

describe("applyPatch", () => {
  it("usuário edita a descrição: aplica, trava o campo e preserva a original", () => {
    const { next, changes } = applyPatch(
      tx(),
      { description: "Feira do sábado" },
      { type: "user" },
    );
    expect(next.description).toBe("Feira do sábado");
    expect(next.descriptionOriginal).toBe("PAG*JOSEDASILVA");
    expect(next.lockedFields).toEqual(["description"]);
    expect(changes.description).toEqual({ old: null, new: "Feira do sábado" });
  });

  it("ator automático preserva campo travado e informa protectedFields", () => {
    const locked = tx({ description: "Feira", lockedFields: ["description"] });
    const { next, changes, protectedFields } = applyPatch(
      locked,
      { description: "OUTRA" },
      { type: "ai" },
    );
    expect(next.description).toBe("Feira");
    expect(protectedFields).toEqual(["description"]);
    expect(changes).toEqual({});
  });

  it("fato de importada: usuário recebe imported_fact; ator automático é ignorado", () => {
    expect(() => applyPatch(tx(), { amountCents: -1 }, { type: "user" })).toThrow(
      expect.objectContaining({ code: "forbidden_operation", reason: "imported_fact" }),
    );
    const { next } = applyPatch(tx(), { amountCents: -1 }, { type: "rule" });
    expect(next.amountCents).toBe(-5000);
  });

  it("transação manual: usuário edita valor/data e o campo fica travado", () => {
    const manual = tx({ source: "manual", externalId: null, identityKey: "man:x", batchId: null });
    const { next } = applyPatch(
      manual,
      { amountCents: -6000, bookedOn: "2026-09-11" },
      { type: "user" },
    );
    expect(next).toMatchObject({ amountCents: -6000, bookedOn: "2026-09-11" });
    expect(next.lockedFields).toEqual(expect.arrayContaining(["amountCents", "bookedOn"]));
  });

  it("categoria manual: origem manual, confiança zerada e campo travado", () => {
    const { next } = applyPatch(
      tx(),
      { category: { id: CAT_B, confidence: 99 } },
      { type: "user" },
    );
    expect(next).toMatchObject({
      categoryId: CAT_B,
      categorySource: "manual",
      categoryConfidence: null,
    });
    expect(next.lockedFields).toContain("categoryId");
  });

  it('"Sem categoria" manual trava categoryId com null; atribuir uncategorized normaliza para null', () => {
    const { next } = applyPatch(
      tx(),
      { category: { id: UNCATEGORIZED } },
      { type: "user" },
      lookups,
    );
    expect(next).toMatchObject({
      categoryId: null,
      categorySource: null,
      categoryConfidence: null,
    });
    expect(next.lockedFields).toContain("categoryId");
    const ai = applyPatch(
      next,
      { category: { id: CAT_A, confidence: 90 } },
      { type: "ai" },
      lookups,
    );
    expect(ai.next.categoryId).toBeNull();
    expect(ai.protectedFields).toEqual(["categoryId"]);
  });

  it("categoria de IA não travada é atualizável com origem e confiança", () => {
    const { next } = applyPatch(tx(), { category: { id: CAT_B, confidence: 88 } }, { type: "ai" });
    expect(next).toMatchObject({ categoryId: CAT_B, categorySource: "ai", categoryConfidence: 88 });
    expect(next.lockedFields).toEqual([]);
  });

  it("posted → pending é proibido", () => {
    expect(() => applyPatch(tx(), { status: "pending" }, { type: "sync" })).toThrow(
      expect.objectContaining({ reason: "status_regression" }),
    );
  });

  it("patch sem efeito não gera mudanças", () => {
    const { changes } = applyPatch(tx(), { notes: null }, { type: "ai" });
    expect(changes).toEqual({});
  });

  it("transação excluída não aceita patch", () => {
    expect(() =>
      applyPatch(
        tx({ deletedAt: "2026-09-12T00:00:00.000Z", deletedReason: "user" }),
        { notes: "x" },
        { type: "user" },
      ),
    ).toThrow(expect.objectContaining({ reason: "deleted" }));
  });
});
