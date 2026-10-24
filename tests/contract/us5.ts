import { describe, expect, it } from "vitest";
import {
  AI,
  expectCoreError,
  IMPORT,
  importRows,
  incoming,
  manualAccount,
  newBatch,
  USER,
  type StorePair,
} from "./helpers";

/** 004 · T048 — US5: trilha de auditoria e desfazer lote (FR-035, FR-039, FR-041, FR-043, D-C). */
export function us5Contract(get: () => StorePair) {
  describe("US5 · auditoria e desfazer lote", () => {
    it("history traz create/update/soft_delete/restore com ator, lote e changes, mais recente primeiro", async () => {
      const { store } = get();
      const account = await manualAccount(store);
      const { batch, result } = await importRows(store, [incoming(account.id)]);
      const id = result.results[0].id!;
      await store.transactions.update(id, { description: "Café da manhã" }, USER);
      const leisure = (await store.categories.tree()).find((c) => c.templateKey === "leisure")!;
      await store.transactions.update(id, { category: { id: leisure.id, confidence: 77 } }, AI);
      await store.transactions.softDelete([id], "user", USER);
      await store.transactions.restore([id], USER);

      const { items } = await store.audit.history("transaction", id);
      expect(items.map((e) => e.action)).toEqual([
        "restore",
        "soft_delete",
        "update",
        "update",
        "create",
      ]);
      const create = items[4];
      expect(create.actor).toMatchObject({ type: "import", batchId: batch.id });
      expect(create.changes.amountCents).toEqual({ old: null, new: -800 });
      expect(items[3].changes.description).toEqual({ old: null, new: "Café da manhã" });
      expect(items[2].actor).toMatchObject({ type: "ai", ref: "modelo-ficticio" });
      expect(items[1]).toMatchObject({ reason: "user" });
      for (const entry of items) {
        expect(JSON.stringify(entry)).not.toMatch(/password|secret|token|cpf/i);
        expect(typeof entry.occurredAt).toBe("string");
      }
      // paginação
      const first = await store.audit.history("transaction", id, { limit: 2 });
      const second = await store.audit.history("transaction", id, {
        limit: 2,
        cursor: first.nextCursor,
      });
      expect([...first.items, ...second.items].map((e) => e.id)).toEqual(
        items.slice(0, 4).map((e) => e.id),
      );
    });

    it("undo de lote concluído: {deleted, withManualEdits}, lote undone e auditoria undo_batch", async () => {
      const { store } = get();
      const account = await manualAccount(store);
      const rows = Array.from({ length: 5 }, (_, i) =>
        incoming(account.id, { descriptionOriginal: `LINHA ${i}`, amountCents: -100 * (i + 1) }),
      );
      const { batch, result } = await importRows(store, rows);
      await store.transactions.update(result.results[0].id!, { description: "editada 1" }, USER);
      await store.transactions.update(result.results[1].id!, { notes: "editada 2" }, USER);
      expect(await store.batches.undo(batch.id, USER)).toEqual({ deleted: 5, withManualEdits: 2 });
      expect((await store.batches.get(batch.id)).status).toBe("undone");
      expect((await store.transactions.list({})).items).toEqual([]);
      const tx = await store.transactions.get(result.results[0].id!, { includeDeleted: true });
      expect(tx.deletedReason).toBe("batch_undone");
      const batchHistory = await store.audit.history("import_batch", batch.id);
      expect(batchHistory.items[0].action).toBe("undo_batch");
      expect(batchHistory.items.filter((e) => e.action === "undo_batch")).toHaveLength(1);
      // undone é final
      await expectCoreError(store.batches.undo(batch.id, USER), "forbidden_operation", {
        reason: "batch_state",
      });
    });

    it("undo de lote falho funciona; de in_review ou processing é recusado", async () => {
      const { store } = get();
      const account = await manualAccount(store);
      const failed = await newBatch(store);
      await store.transactions.upsertMany(failed.id, [incoming(account.id)], IMPORT);
      await store.batches.finish(failed.id, "failed", IMPORT, "queda simulada");
      expect(await store.batches.undo(failed.id, USER)).toEqual({ deleted: 1, withManualEdits: 0 });
      const review = await newBatch(store, "pdf");
      await store.batches.finish(review.id, "in_review", IMPORT);
      await expectCoreError(store.batches.undo(review.id, USER), "forbidden_operation", {
        reason: "batch_state",
      });
      const open = await newBatch(store);
      await expectCoreError(store.batches.undo(open.id, USER), "forbidden_operation", {
        reason: "batch_state",
      });
    });

    it("D-C: reimportar o mesmo arquivo após undo restaura (restored = n, created = 0)", async () => {
      const { store } = get();
      const account = await manualAccount(store);
      const rows = Array.from({ length: 4 }, (_, i) =>
        incoming(account.id, { descriptionOriginal: `ITEM ${i}`, bookedOn: `2026-09-0${i + 1}` }),
      );
      const first = await importRows(store, rows);
      await store.batches.undo(first.batch.id, USER);
      const again = await importRows(store, rows);
      expect(again.result).toMatchObject({ restored: 4, created: 0, duplicate: 0 });
      expect((await store.batches.get(again.batch.id)).counts.restored).toBe(4);
      const id = first.result.results[0].id!;
      const tx = await store.transactions.get(id);
      expect(tx).toMatchObject({ deletedAt: null, batchId: first.batch.id });
      const restore = (await store.audit.history("transaction", id)).items[0];
      expect(restore).toMatchObject({
        action: "restore",
        reason: "reimport",
        actor: { batchId: again.batch.id },
      });
      // findCompletedByFile não sinaliza lote desfeito
      expect((await store.transactions.list({})).items).toHaveLength(4);
    });

    it("D-C por linha: arquivo sobreposto restaura só as linhas do lote desfeito; excluída pelo usuário segue duplicate", async () => {
      const { store } = get();
      const account = await manualAccount(store);
      const day = (d: number) => `2026-09-${String(d).padStart(2, "0")}`;
      const original = Array.from({ length: 6 }, (_, i) =>
        incoming(account.id, { descriptionOriginal: `SET ${i + 1}`, bookedOn: day(i + 1) }),
      );
      const first = await importRows(store, original);
      const userDeleted = first.result.results[3].id!;
      await store.transactions.softDelete([userDeleted], "user", USER);
      await store.batches.undo(first.batch.id, USER);
      // sobreposição: linhas 3..6 do original (uma excluída pelo usuário) + 2 novas
      const overlap = [
        ...original.slice(2),
        incoming(account.id, { descriptionOriginal: "OUT 1", bookedOn: "2026-10-01" }),
        incoming(account.id, { descriptionOriginal: "OUT 2", bookedOn: "2026-10-02" }),
      ];
      const again = await importRows(store, overlap);
      expect(again.result).toMatchObject({ restored: 3, created: 2, duplicate: 1 });
      expect(
        (await store.transactions.get(userDeleted, { includeDeleted: true })).deletedReason,
      ).toBe("user");
      expect(
        (await store.transactions.get(first.result.results[0].id!, { includeDeleted: true }))
          .deletedReason,
      ).toBe("batch_undone");
    });

    it("restaurar manualmente após undo", async () => {
      const { store } = get();
      const account = await manualAccount(store);
      const { batch, result } = await importRows(store, [incoming(account.id)]);
      await store.batches.undo(batch.id, USER);
      const id = result.results[0].id!;
      expect(await store.transactions.restore([id], USER)).toBe(1);
      expect((await store.transactions.get(id)).deletedAt).toBeNull();
    });

    it("conta, categoria e lote também são auditados", async () => {
      const { store } = get();
      const account = await manualAccount(store);
      await store.accounts.update(account.id, { nickname: "Principal" }, USER);
      const accountHistory = await store.audit.history("account", account.id);
      expect(accountHistory.items.map((e) => e.action)).toEqual(["update", "create"]);
      expect(accountHistory.items[0].changes.nickname).toEqual({ old: null, new: "Principal" });
      const category = await store.categories.create(
        { name: "Hobbies novos", kind: "expense" },
        USER,
      );
      await store.categories.remove(category.id, { children: "move" }, USER);
      const categoryHistory = await store.audit.history("category", category.id);
      expect(categoryHistory.items[0]).toMatchObject({ action: "soft_delete", reason: "user" });
      const batch = await newBatch(store);
      await store.batches.finish(batch.id, "completed", IMPORT);
      const batchHistory = await store.audit.history("import_batch", batch.id);
      expect(batchHistory.items[0].changes.status).toEqual({ old: "processing", new: "completed" });
    });
  });
}
