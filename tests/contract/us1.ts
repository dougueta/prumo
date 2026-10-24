import { describe, expect, it } from "vitest";
import {
  countActive,
  expectCoreError,
  IMPORT,
  importRows,
  incoming,
  manualAccount,
  MISSING_ID,
  newBatch,
  USER,
  type StorePair,
} from "./helpers";

/** 004 · T022 — US1: contrato único e confiável de transações (FR-013–FR-018, FR-021, FR-022,
 * FR-033, FR-034, FR-042, FR-043). */
export function us1Contract(get: () => StorePair) {
  describe("US1 · gravação idempotente de transações", () => {
    it("upsert cria a transação com todos os campos e vínculo ao lote", async () => {
      const { store } = get();
      const account = await manualAccount(store);
      const batch = await newBatch(store, "ofx");
      const result = await store.transactions.upsertMany(
        batch.id,
        [
          incoming(account.id, {
            source: "ofx",
            externalId: "X1",
            amountCents: -12_345,
            bookedOn: "2026-09-30",
            descriptionOriginal: "PAG*LOJA FICTICIA",
            occurredAt: "2026-10-01T02:30:00Z",
            merchant: "Loja Fictícia",
            status: "posted",
            installment: { number: 2, total: 6, group: "g-1" },
            original: { currency: "USD", amountMinor: 2_000 },
          }),
        ],
        IMPORT,
      );
      expect(result).toMatchObject({ created: 1, duplicate: 0, rejected: 0 });
      expect(result.results[0]).toMatchObject({ index: 0, outcome: "created" });
      const tx = await store.transactions.get(result.results[0].id!);
      expect(tx).toMatchObject({
        accountId: account.id,
        batchId: batch.id,
        source: "ofx",
        externalId: "X1",
        identityKey: "ext:X1",
        amountCents: -12_345,
        bookedOn: "2026-09-30",
        descriptionOriginal: "PAG*LOJA FICTICIA",
        description: null,
        merchant: "Loja Fictícia",
        status: "posted",
        nature: "regular",
        categoryId: null,
        installment: { number: 2, total: 6, group: "g-1" },
        original: { currency: "USD", amountMinor: 2_000 },
        lockedFields: [],
        deletedAt: null,
      });
      expect(new Date(tx.occurredAt!).toISOString()).toBe("2026-10-01T02:30:00.000Z");
    });

    it("reenviar as mesmas linhas em lote novo não cria nada (duplicate = n)", async () => {
      const { store } = get();
      const account = await manualAccount(store);
      const rows = [
        incoming(account.id, { source: "ofx", externalId: "A1" }),
        incoming(account.id, { source: "ofx", externalId: "A2", amountCents: -100 }),
      ];
      const first = await importRows(store, rows.slice(0, 2), "ofx");
      expect(first.result.created).toBe(2);
      const second = await importRows(store, rows.slice(0, 2), "ofx");
      expect(second.result).toMatchObject({ created: 0, duplicate: 2 });
      expect(await countActive(store)).toBe(2);
      const batch = await store.batches.get(second.batch.id);
      expect(batch.counts).toMatchObject({ read: 2, created: 0, duplicate: 2, rejected: 0 });
      expect(batch.status).toBe("completed");
    });

    it("CSV sem id: identidade por impressão digital é idempotente", async () => {
      const { store } = get();
      const account = await manualAccount(store);
      const rows = [
        incoming(account.id, { descriptionOriginal: "Padaria Pão Imaginário", amountCents: -1500 }),
        incoming(account.id, { descriptionOriginal: "Mercado Vila Fictícia", amountCents: -9000 }),
      ];
      expect((await importRows(store, rows)).result.created).toBe(2);
      const again = await importRows(store, [
        { ...rows[1] },
        { ...rows[0], descriptionOriginal: "  padaria pao imaginario " },
      ]);
      expect(again.result).toMatchObject({ created: 0, duplicate: 2 });
      const page = await store.transactions.list({});
      expect(page.items.every((t) => t.identityKey.startsWith("fp:"))).toBe(true);
    });

    it("dois cafés idênticos no mesmo arquivo viram 2 transações, inclusive em chamadas diferentes do mesmo lote", async () => {
      const { store } = get();
      const account = await manualAccount(store);
      const cafe = incoming(account.id);
      const batch = await newBatch(store);
      const a = await store.transactions.upsertMany(batch.id, [cafe], IMPORT);
      const b = await store.transactions.upsertMany(batch.id, [cafe], IMPORT);
      await store.batches.finish(batch.id, "completed", IMPORT);
      expect(a.created + b.created).toBe(2);
      const page = await store.transactions.list({});
      const keys = new Set(page.items.map((t) => t.identityKey));
      expect(keys.size).toBe(2);
      // reimportação do arquivo inteiro reconhece os dois
      const again = await importRows(store, [cafe, cafe]);
      expect(again.result).toMatchObject({ created: 0, duplicate: 2 });
      expect(await countActive(store)).toBe(2);
    });

    it("mesmo id externo em contas diferentes gera transações distintas", async () => {
      const { store } = get();
      const a = await manualAccount(store);
      const b = await manualAccount(store, { name: "Conta Horizonte (simulada)" });
      const result = await importRows(
        store,
        [
          incoming(a.id, { source: "ofx", externalId: "SAME" }),
          incoming(b.id, { source: "ofx", externalId: "SAME" }),
        ],
        "ofx",
      );
      expect(result.result.created).toBe(2);
    });

    it("aceita valor zero, data futura e descrição original vazia (preservada)", async () => {
      const { store } = get();
      const account = await manualAccount(store);
      const { result } = await importRows(store, [
        incoming(account.id, { amountCents: 0, descriptionOriginal: "TARIFA ISENTA" }),
        incoming(account.id, { bookedOn: "2030-01-10", descriptionOriginal: "PARCELA FUTURA" }),
        incoming(account.id, { descriptionOriginal: "" }),
      ]);
      expect(result.created).toBe(3);
      const empty = await store.transactions.get(result.results[2].id!);
      expect(empty.descriptionOriginal).toBe("");
    });

    it("rejeita fração de centavo, data inválida e parcela n>m identificando o campo", async () => {
      const { store } = get();
      const account = await manualAccount(store);
      const batch = await newBatch(store);
      const result = await store.transactions.upsertMany(
        batch.id,
        [
          incoming(account.id, { amountCents: 12.5 }),
          incoming(account.id, { bookedOn: "2026-02-30" }),
          incoming(account.id, { installment: { number: 5, total: 3, group: "g" } }),
          incoming(account.id, { descriptionOriginal: "VALIDA" }),
        ],
        IMPORT,
      );
      expect(result).toMatchObject({ created: 1, rejected: 3 });
      expect(result.results.map((r) => r.outcome)).toEqual([
        "rejected",
        "rejected",
        "rejected",
        "created",
      ]);
      expect(result.results[0].error).toMatchObject({ code: "validation", field: "amountCents" });
      expect(result.results[1].error).toMatchObject({ code: "validation", field: "bookedOn" });
      expect(result.results[2].error).toMatchObject({ code: "validation", field: "installment" });
      expect((await store.batches.get(batch.id)).counts).toMatchObject({
        read: 4,
        created: 1,
        rejected: 3,
      });
    });

    it("conta arquivada e conta inexistente são rejeitadas por linha", async () => {
      const { store } = get();
      const account = await manualAccount(store);
      await store.accounts.setArchived(account.id, true, USER);
      const batch = await newBatch(store);
      const result = await store.transactions.upsertMany(
        batch.id,
        [incoming(account.id), incoming(MISSING_ID)],
        IMPORT,
      );
      expect(result.rejected).toBe(2);
      expect(result.results[0].error).toMatchObject({ field: "accountId" });
      expect(result.results[1].error).toMatchObject({ code: "not_found" });
    });

    it("transação importada exige lote existente do dono", async () => {
      const { store } = get();
      const account = await manualAccount(store);
      await expectCoreError(
        store.transactions.upsertMany(MISSING_ID, [incoming(account.id)], IMPORT),
        "not_found",
      );
    });

    it("linhas de outra origem que a do lote recusam a chamada (data-model §5, passo 1)", async () => {
      const { store } = get();
      const account = await manualAccount(store);
      const batch = await newBatch(store, "ofx");
      await expectCoreError(
        store.transactions.upsertMany(batch.id, [incoming(account.id, { source: "csv" })], IMPORT),
        "forbidden_operation",
        { reason: "batch_closed" },
      );
      expect(await countActive(store)).toBe(0);
    });

    it("lote em revisão recusa gravação (batch_closed) e, após resume, aceita", async () => {
      const { store } = get();
      const account = await manualAccount(store);
      const batch = await newBatch(store, "pdf");
      await store.batches.finish(batch.id, "in_review", IMPORT);
      const row = incoming(account.id, { source: "pdf" });
      await expectCoreError(
        store.transactions.upsertMany(batch.id, [row], IMPORT),
        "forbidden_operation",
        {
          reason: "batch_closed",
        },
      );
      expect(await countActive(store)).toBe(0);
      const resumed = await store.batches.resume(batch.id, USER);
      expect(resumed.status).toBe("processing");
      expect((await store.transactions.upsertMany(batch.id, [row], IMPORT)).created).toBe(1);
      const done = await store.batches.finish(batch.id, "completed", IMPORT);
      expect(done.status).toBe("completed");
      expect(done.finishedAt).not.toBeNull();
    });

    it("lote concluído não recebe mais transações", async () => {
      const { store } = get();
      const account = await manualAccount(store);
      const { batch } = await importRows(store, [incoming(account.id)]);
      await expectCoreError(
        store.transactions.upsertMany(
          batch.id,
          [incoming(account.id, { amountCents: -1 })],
          IMPORT,
        ),
        "forbidden_operation",
        { reason: "batch_closed" },
      );
    });

    it("reimportar transação excluída pelo usuário não a ressuscita", async () => {
      const { store } = get();
      const account = await manualAccount(store);
      const { result } = await importRows(store, [incoming(account.id)]);
      const id = result.results[0].id!;
      expect(await store.transactions.softDelete([id], "user", USER)).toBe(1);
      const again = await importRows(store, [incoming(account.id)]);
      expect(again.result).toMatchObject({ created: 0, restored: 0, duplicate: 1 });
      expect((await store.transactions.get(id, { includeDeleted: true })).deletedReason).toBe(
        "user",
      );
      await expectCoreError(store.transactions.get(id), "not_found");
    });

    it("findCompletedByFile só encontra lote concluído do mesmo arquivo e conta", async () => {
      const { store } = get();
      const account = await manualAccount(store);
      const sha = "a".repeat(64);
      const open = await newBatch(store, "csv", { accountId: account.id, fileSha256: sha });
      expect(await store.batches.findCompletedByFile(account.id, sha)).toBeNull();
      await store.batches.finish(open.id, "completed", IMPORT);
      expect((await store.batches.findCompletedByFile(account.id, sha))?.id).toBe(open.id);
      expect(await store.batches.findCompletedByFile(account.id, "b".repeat(64))).toBeNull();
      const failed = await newBatch(store, "csv", {
        accountId: account.id,
        fileSha256: "c".repeat(64),
      });
      await store.batches.finish(failed.id, "failed", IMPORT, "falha simulada");
      expect(await store.batches.findCompletedByFile(account.id, "c".repeat(64))).toBeNull();
    });

    it("lote: create nasce em processing com contadores zerados; finish(failed) guarda resumo", async () => {
      const { store } = get();
      const account = await manualAccount(store);
      const batch = await newBatch(store, "csv", {
        accountId: account.id,
        fileName: "extrato-ficticio.csv",
        periodStart: "2026-09-01",
        periodEnd: "2026-09-30",
      });
      expect(batch).toMatchObject({
        status: "processing",
        source: "csv",
        accountId: account.id,
        initiatedBy: "user",
        fileName: "extrato-ficticio.csv",
        periodStart: "2026-09-01",
        periodEnd: "2026-09-30",
        finishedAt: null,
        counts: {
          read: 0,
          created: 0,
          updated: 0,
          restored: 0,
          duplicate: 0,
          protected: 0,
          rejected: 0,
        },
      });
      const failed = await store.batches.finish(batch.id, "failed", IMPORT, "timeout simulado");
      expect(failed).toMatchObject({ status: "failed", errorSummary: "timeout simulado" });
      await expectCoreError(store.batches.resume(batch.id, USER), "forbidden_operation", {
        reason: "batch_state",
      });
    });

    it("batches.list é paginado (mais recente primeiro) e batches.get acha por id", async () => {
      const { store } = get();
      const ids = [];
      for (let i = 0; i < 3; i++) ids.push((await newBatch(store)).id);
      const first = await store.batches.list({ limit: 2 });
      expect(first.items).toHaveLength(2);
      expect(first.nextCursor).not.toBeNull();
      const second = await store.batches.list({ limit: 2, cursor: first.nextCursor });
      expect(second.items).toHaveLength(1);
      expect(second.nextCursor).toBeNull();
      expect([...first.items, ...second.items].map((b) => b.id)).toEqual([...ids].reverse());
      expect((await store.batches.get(ids[1])).id).toBe(ids[1]);
      await expectCoreError(store.batches.get(MISSING_ID), "not_found");
      await expectCoreError(store.batches.list({ cursor: "lixo" }), "validation");
    });

    it("list ordena por bookedOn DESC, id DESC, pagina por cursor e filtra conta/período/status", async () => {
      const { store } = get();
      const a = await manualAccount(store);
      const b = await manualAccount(store, { name: "Conta Horizonte (simulada)" });
      await importRows(store, [
        incoming(a.id, { bookedOn: "2026-09-01", descriptionOriginal: "A1" }),
        incoming(a.id, { bookedOn: "2026-09-15", descriptionOriginal: "A2" }),
        incoming(a.id, { bookedOn: "2026-09-15", descriptionOriginal: "A3" }),
        incoming(b.id, { bookedOn: "2026-08-20", descriptionOriginal: "B1" }),
        incoming(b.id, { bookedOn: "2026-10-02", descriptionOriginal: "B2", status: "pending" }),
      ]);
      const seen = [];
      let cursor: string | null = null;
      do {
        const page = await store.transactions.list({ limit: 2, cursor });
        expect(page.items.length).toBeLessThanOrEqual(2);
        seen.push(...page.items);
        cursor = page.nextCursor;
      } while (cursor);
      expect(seen).toHaveLength(5);
      const sorted = [...seen].sort(
        (x, y) => y.bookedOn.localeCompare(x.bookedOn) || (y.id > x.id ? 1 : y.id < x.id ? -1 : 0),
      );
      expect(seen.map((t) => t.id)).toEqual(sorted.map((t) => t.id));

      const september = await store.transactions.list({ from: "2026-09-01", to: "2026-09-30" });
      expect(september.items.map((t) => t.descriptionOriginal).sort()).toEqual(["A1", "A2", "A3"]);
      const onlyB = await store.transactions.list({ accountIds: [b.id] });
      expect(onlyB.items).toHaveLength(2);
      const pending = await store.transactions.list({ status: "pending" });
      expect(pending.items.map((t) => t.descriptionOriginal)).toEqual(["B2"]);
      await expectCoreError(store.transactions.list({ limit: 500 }), "validation");
      await expectCoreError(store.transactions.list({ cursor: "%%%" }), "validation");
    });

    it("lista vazia não é erro", async () => {
      const { store } = get();
      expect(await store.transactions.list({})).toEqual({ items: [], nextCursor: null });
      expect((await store.batches.list()).items).toEqual([]);
      expect(await store.accounts.list()).toEqual([]);
    });
  });
}
