import { describe, expect, it } from "vitest";
import { importRows, incoming, manualAccount, SYNC, USER, type StorePair } from "./helpers";

/** 004 · T057 — US7: pendentes e atualizações da fonte (FR-020, FR-037; Clarificação Q2). */
export function us7Contract(get: () => StorePair) {
  describe("US7 · pendentes", () => {
    const pending = (accountId: string, over = {}) =>
      incoming(accountId, {
        source: "pluggy",
        externalId: "P9",
        amountCents: -5_000,
        status: "pending",
        descriptionOriginal: "COMPRA PENDENTE",
        ...over,
      });

    it("pendente → efetivada com outro valor: mesma transação, auditoria do valor anterior", async () => {
      const { store } = get();
      const account = await manualAccount(store);
      const first = await importRows(store, [pending(account.id)], "pluggy", SYNC);
      const id = first.result.results[0].id!;
      const second = await importRows(
        store,
        [
          pending(account.id, {
            amountCents: -5_250,
            status: "posted",
            descriptionOriginal: "COMPRA CONFIRMADA",
          }),
        ],
        "pluggy",
        SYNC,
      );
      expect(second.result).toMatchObject({ created: 0, updated: 1 });
      expect(second.result.results[0].id).toBe(id);
      const tx = await store.transactions.get(id);
      expect(tx).toMatchObject({
        status: "posted",
        amountCents: -5_250,
        descriptionOriginal: "COMPRA CONFIRMADA",
      });
      const last = (await store.audit.history("transaction", id)).items[0];
      expect(last).toMatchObject({
        action: "update",
        actor: { type: "sync", batchId: second.batch.id },
      });
      expect(last.changes.amountCents).toEqual({ old: -5_000, new: -5_250 });
      expect(last.changes.status).toEqual({ old: "pending", new: "posted" });
      const page = await store.transactions.list({ includeDeleted: true });
      expect(page.items).toHaveLength(1);
    });

    it("campos travados pelo usuário ficam intocados na confirmação", async () => {
      const { store } = get();
      const account = await manualAccount(store);
      const first = await importRows(
        store,
        [pending(account.id, { merchant: "LOJA X" })],
        "pluggy",
        SYNC,
      );
      const id = first.result.results[0].id!;
      await store.transactions.update(
        id,
        { merchant: "Loja do bairro", description: "Presente" },
        USER,
      );
      const second = await importRows(
        store,
        [pending(account.id, { status: "posted", amountCents: -4_900, merchant: "LOJA X LTDA" })],
        "pluggy",
        SYNC,
      );
      expect(second.result).toMatchObject({ updated: 1, protected: 1 });
      expect(await store.transactions.get(id)).toMatchObject({
        status: "posted",
        amountCents: -4_900,
        merchant: "Loja do bairro",
        description: "Presente",
      });
    });

    it("efetivada reenviada como pendente não regride", async () => {
      const { store } = get();
      const account = await manualAccount(store);
      const first = await importRows(
        store,
        [pending(account.id, { status: "posted" })],
        "pluggy",
        SYNC,
      );
      const id = first.result.results[0].id!;
      const second = await importRows(
        store,
        [pending(account.id, { amountCents: -1 })],
        "pluggy",
        SYNC,
      );
      expect(second.result).toMatchObject({ duplicate: 1, updated: 0 });
      expect(await store.transactions.get(id)).toMatchObject({
        status: "posted",
        amountCents: -5_000,
      });
    });

    it("cancelada na fonte: exclusão lógica auditada; reenvio posterior não ressuscita", async () => {
      const { store } = get();
      const account = await manualAccount(store);
      const first = await importRows(store, [pending(account.id)], "pluggy", SYNC);
      const id = first.result.results[0].id!;
      expect(await store.transactions.softDelete([id], "canceled_at_source", SYNC)).toBe(1);
      const deleted = await store.transactions.get(id, { includeDeleted: true });
      expect(deleted.deletedReason).toBe("canceled_at_source");
      expect((await store.audit.history("transaction", id)).items[0]).toMatchObject({
        action: "soft_delete",
        reason: "canceled_at_source",
        actor: { type: "sync" },
      });
      const again = await importRows(store, [pending(account.id)], "pluggy", SYNC);
      expect(again.result).toMatchObject({ duplicate: 1, restored: 0, created: 0 });
      expect((await store.transactions.get(id, { includeDeleted: true })).deletedReason).toBe(
        "canceled_at_source",
      );
    });
  });
}
