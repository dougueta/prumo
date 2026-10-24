import { describe, expect, it } from "vitest";
import {
  expectCoreError,
  IMPORT,
  importRows,
  incoming,
  manualAccount,
  newBatch,
  USER,
  type StorePair,
} from "./helpers";

/** 004 · T036 — US3: isolamento por dono (FR-001–FR-004, SC-003). */
export function us3Contract(get: () => StorePair) {
  describe("US3 · isolamento entre donos", () => {
    async function seedOther(other: StorePair["other"]) {
      const account = await manualAccount(other, { name: "Conta do outro dono (simulada)" });
      const { batch, result } = await importRows(other, [incoming(account.id)]);
      const category = await other.categories.create({ name: "Só do B", kind: "expense" }, USER);
      return { account, batch, txId: result.results[0].id!, category };
    }

    it("get/update/softDelete/restore de id alheio ⇒ not_found", async () => {
      const { store, other } = get();
      const b = await seedOther(other);
      await expectCoreError(store.transactions.get(b.txId), "not_found");
      await expectCoreError(store.transactions.get(b.txId, { includeDeleted: true }), "not_found");
      await expectCoreError(store.transactions.update(b.txId, { notes: "x" }, USER), "not_found");
      await expectCoreError(store.transactions.softDelete([b.txId], "user", USER), "not_found");
      await expectCoreError(store.transactions.restore([b.txId], USER), "not_found");
      await expectCoreError(store.transactions.unlockField(b.txId, "notes", USER), "not_found");
      await expectCoreError(store.accounts.get(b.account.id), "not_found");
      await expectCoreError(store.accounts.setArchived(b.account.id, true, USER), "not_found");
      await expectCoreError(store.batches.get(b.batch.id), "not_found");
      await expectCoreError(store.batches.undo(b.batch.id, USER), "not_found");
      await expectCoreError(
        store.categories.update(b.category.id, { name: "Invasão" }, USER),
        "not_found",
      );
      await expectCoreError(
        store.categories.remove(b.category.id, { children: "move" }, USER),
        "not_found",
      );
      // nada mudou do lado de B
      expect((await other.transactions.get(b.txId)).notes).toBeNull();
      expect((await other.accounts.get(b.account.id)).archivedAt).toBeNull();
    });

    it("list/tree/batches.list/audit.history nunca devolvem dados do outro dono", async () => {
      const { store, other } = get();
      const b = await seedOther(other);
      const account = await manualAccount(store);
      await importRows(store, [incoming(account.id, { descriptionOriginal: "DO A" })]);
      const page = await store.transactions.list({ includeDeleted: true });
      expect(page.items.every((t) => t.ownerId === store.ownerId)).toBe(true);
      expect(page.items).toHaveLength(1);
      expect((await store.accounts.list({ includeArchived: true })).map((a) => a.id)).toEqual([
        account.id,
      ]);
      const tree = await store.categories.tree({ includeHidden: true, includeDeleted: true });
      expect(tree.some((c) => c.id === b.category.id)).toBe(false);
      expect((await store.batches.list()).items.every((x) => x.ownerId === store.ownerId)).toBe(
        true,
      );
      expect((await store.audit.history("transaction", b.txId)).items).toEqual([]);
      const institutions = await store.institutions.list();
      expect(institutions.every((i) => i.ownerId === null || i.ownerId === store.ownerId)).toBe(
        true,
      );
    });

    it("vincular conta/categoria/lote/relacionada de outro dono ⇒ not_found", async () => {
      const { store, other } = get();
      const b = await seedOther(other);
      const account = await manualAccount(store);
      // conta alheia numa linha importada
      const batch = await newBatch(store);
      const result = await store.transactions.upsertMany(
        batch.id,
        [incoming(b.account.id)],
        IMPORT,
      );
      expect(result.results[0]).toMatchObject({
        outcome: "rejected",
        error: { code: "not_found" },
      });
      // lote alheio
      await expectCoreError(
        store.transactions.upsertMany(b.batch.id, [incoming(account.id)], IMPORT),
        "not_found",
      );
      // categoria e relacionada alheias em transação manual
      await expectCoreError(
        store.transactions.createManual(
          {
            accountId: account.id,
            amountCents: -1,
            bookedOn: "2026-09-01",
            description: "x",
            categoryId: b.category.id,
          },
          USER,
        ),
        "not_found",
      );
      await expectCoreError(
        store.transactions.createManual(
          {
            accountId: account.id,
            amountCents: -1,
            bookedOn: "2026-09-01",
            description: "x",
            relatedTransactionId: b.txId,
          },
          USER,
        ),
        "not_found",
      );
      await expectCoreError(
        store.transactions.createManual(
          { accountId: b.account.id, amountCents: -1, bookedOn: "2026-09-01", description: "x" },
          USER,
        ),
        "not_found",
      );
      // conta de lote alheia
      await expectCoreError(newBatch(store, "csv", { accountId: b.account.id }), "not_found");
      // pai de categoria alheio
      await expectCoreError(
        store.categories.create({ name: "Filha", parentId: b.category.id }, USER),
        "not_found",
      );
      // reimportar o id externo de B na conta de A não toca a transação de B
      expect(await other.transactions.get(b.txId)).toMatchObject({ deletedAt: null });
    });

    it("last4 aceita só 4 dígitos; nenhum campo aceita número completo de conta/cartão", async () => {
      const { store } = get();
      await expectCoreError(manualAccount(store, { last4: "1234567890123456" }), "validation", {
        field: "last4",
      });
      await expectCoreError(manualAccount(store, { last4: "12a4" }), "validation");
      const ok = await manualAccount(store, { last4: "4321" });
      expect(ok.last4).toBe("4321");
      expect(Object.keys(ok)).not.toEqual(
        expect.arrayContaining(["accountNumber", "cardNumber", "cpf", "password"]),
      );
    });
  });
}
