import { beforeEach, describe, expect, it } from "vitest";
import { createCoreStore, type CoreStore } from "@/data/core";
import { fingerprintBase } from "@/domain/core/identity";
import { createTestOwner, lit, serviceClient, sql, sqlTry } from "../../helpers/supabase-test";
import { AI, IMPORT, SYNC, USER, incoming, manualAccount, newBatch } from "../../contract/helpers";
import { generateDataset } from "@/synthetic/generate";

// 004 · T072 — resiliência do lote (FR-022, FR-033; edge case "falha no meio de um lote").
let store: CoreStore;
let owner: string;

beforeEach(async () => {
  owner = (await createTestOwner()).id;
  store = createCoreStore({ kind: "service", ownerId: owner, client: serviceClient() });
});

const occurrences = (batchId: string) =>
  JSON.parse(
    sql(`select fp_occurrences::text from public.import_batches where id = ${lit(batchId)};`),
  );
const txCount = () =>
  Number(sql(`select count(*) from public.transactions where owner_id = ${lit(owner)};`));

describe("lote com chamada que falha", () => {
  it("a chamada que falha é revertida inteira (inclusive fp_occurrences) e as anteriores ficam", async () => {
    const account = await manualAccount(store);
    const batch = await newBatch(store);
    const cafe = incoming(account.id);
    await store.transactions.upsertMany(batch.id, [cafe], IMPORT);
    const base = fingerprintBase(cafe);
    expect(occurrences(batch.id)).toEqual({ [base]: 1 });

    const row = {
      account_id: account.id,
      source: "csv",
      fp_base: base,
      amount_cents: -800,
      booked_on: "2026-09-12",
      description_original: "CAFE FICTICIO",
      status: "posted",
    };
    const failed = sqlTry(`begin;
set local role service_role;
set local request.jwt.claims = '{"role":"service_role"}';
select public.core_upsert_transactions(${lit(batch.id)}, ${lit(JSON.stringify([row]))}::jsonb, ${lit(owner)}, '{"type":"import"}'::jsonb);
select 1/0;
commit;`);
    expect(failed.ok).toBe(false);
    expect(txCount()).toBe(1);
    expect(occurrences(batch.id)).toEqual({ [base]: 1 });

    // repetir a chamada que falhou é seguro: vira a 2ª ocorrência
    expect((await store.transactions.upsertMany(batch.id, [cafe], IMPORT)).created).toBe(1);
    expect(occurrences(batch.id)).toEqual({ [base]: 2 });
  });

  it("finish(failed) guarda contadores parciais; reprocessar em lote novo não duplica; o lote falho pode ser desfeito", async () => {
    const account = await manualAccount(store);
    const batch = await newBatch(store);
    const rows = [incoming(account.id), incoming(account.id, { amountCents: -1200 })];
    await store.transactions.upsertMany(batch.id, rows, IMPORT);
    const failed = await store.batches.finish(batch.id, "failed", IMPORT, "queda simulada");
    expect(failed.counts).toMatchObject({ read: 2, created: 2 });

    const retry = await newBatch(store);
    const result = await store.transactions.upsertMany(
      retry.id,
      [...rows, incoming(account.id, { amountCents: -50 })],
      IMPORT,
    );
    expect(result).toMatchObject({ created: 1, duplicate: 2 });
    expect(txCount()).toBe(3);
  });

  it("chamadas concorrentes ao mesmo lote são serializadas sem perder ocorrências", async () => {
    const account = await manualAccount(store);
    const batch = await newBatch(store);
    const cafe = incoming(account.id);
    const results = await Promise.all([
      store.transactions.upsertMany(batch.id, [cafe], IMPORT),
      store.transactions.upsertMany(batch.id, [cafe], IMPORT),
      store.transactions.upsertMany(batch.id, [cafe], IMPORT),
    ]);
    expect(results.reduce((n, r) => n + r.created, 0)).toBe(3);
    expect(occurrences(batch.id)).toEqual({ [fingerprintBase(cafe)]: 3 });
    expect(txCount()).toBe(3);
  });
});

// 004 · T061 — SC-001 e SC-002.
describe("critérios de sucesso de resiliência", () => {
  it("SC-001: 10 reimportações (lotes novos) do dataset sintético não criam duplicatas", async () => {
    const ds = generateDataset({ seed: 42, months: 12, anchorDate: "2026-09-30" });
    const accountIds = new Map<string, string>();
    for (const account of ds.accounts) {
      accountIds.set(account.id, (await manualAccount(store, { name: account.name })).id);
    }
    const rows = ds.transactions.map((t) =>
      incoming(accountIds.get(t.accountId)!, {
        source: "ofx",
        externalId: t.id,
        amountCents: t.amountCents,
        bookedOn: t.date,
        descriptionOriginal: t.description,
      }),
    );
    for (let i = 0; i < 10; i++) {
      const batch = await newBatch(store, "ofx");
      const result = await store.transactions.upsertMany(batch.id, rows, IMPORT);
      await store.batches.finish(batch.id, "completed", IMPORT);
      expect(result.created).toBe(i === 0 ? rows.length : 0);
    }
    expect(txCount()).toBe(ds.transactions.length);
  }, 300_000);

  it("SC-002: 100 ciclos de sync/recategorização automática mantêm 100% dos campos manuais", async () => {
    const account = await manualAccount(store);
    const tree = await store.categories.tree();
    const [manualCat, autoCat] = tree.find((c) => c.templateKey === "food")!.children;
    const rows = Array.from({ length: 10 }, (_, i) =>
      incoming(account.id, {
        source: "pluggy",
        externalId: `SC2-${i}`,
        descriptionOriginal: `ORIG ${i}`,
      }),
    );
    const first = await newBatch(store, "pluggy");
    const created = await store.transactions.upsertMany(first.id, rows, SYNC);
    await store.batches.finish(first.id, "completed", SYNC);
    const ids = created.results.map((r) => r.id!);
    for (const id of ids) {
      await store.transactions.update(
        id,
        { description: "Manual", merchant: "Meu estabelecimento", category: { id: manualCat.id } },
        USER,
      );
    }
    for (let cycle = 0; cycle < 100; cycle++) {
      const batch = await newBatch(store, "pluggy");
      await store.transactions.upsertMany(
        batch.id,
        rows.map((r) => ({
          ...r,
          merchant: `FONTE ${cycle}`,
          category: { id: autoCat.id, source: "source" as const },
        })),
        SYNC,
      );
      await store.batches.finish(batch.id, "completed", SYNC);
      const target = ids[cycle % ids.length];
      await store.transactions.update(
        target,
        { category: { id: autoCat.id, confidence: 90 }, description: "IA" },
        AI,
      );
    }
    for (const id of ids) {
      expect(await store.transactions.get(id)).toMatchObject({
        description: "Manual",
        merchant: "Meu estabelecimento",
        categoryId: manualCat.id,
        categorySource: "manual",
      });
    }
  }, 300_000);
});
