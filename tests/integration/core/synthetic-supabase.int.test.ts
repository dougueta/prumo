import { describe, expect, it } from "vitest";
import { createCoreStore, DEMO_OWNER_ID, type CoreStore, type IncomingTx } from "@/data/core";
import { fromSyntheticDataset } from "@/data/core/synthetic-adapter";
import { generateDataset } from "@/synthetic/generate";
import { createTestOwner, serviceClient } from "../../helpers/supabase-test";

// 004 · T074 — o dataset da semente 42 gravado no Supabase dá as mesmas somas que a memória
// (SC-006, FR-045).
async function monthlySums(store: CoreStore): Promise<Record<string, number>> {
  const sums: Record<string, number> = {};
  let cursor: string | null = null;
  do {
    const page = await store.transactions.list({ limit: 200, cursor });
    for (const t of page.items)
      sums[t.bookedOn.slice(0, 7)] = (sums[t.bookedOn.slice(0, 7)] ?? 0) + t.amountCents;
    cursor = page.nextCursor;
  } while (cursor);
  return sums;
}

describe("dados sintéticos no Supabase", () => {
  it("somas por mês iguais ao dataset e à memória", async () => {
    const ds = generateDataset({ seed: 42, months: 12, anchorDate: "2026-09-30" });
    const data = fromSyntheticDataset(ds, DEMO_OWNER_ID);
    const owner = (await createTestOwner()).id;
    const store = createCoreStore({ kind: "service", ownerId: owner, client: serviceClient() });
    const actor = { type: "system" as const, ref: "synthetic-42" };

    const accountIds = new Map<string, string>();
    for (const account of data.accounts) {
      const created = await store.accounts.upsert(
        {
          institutionId: "00000000-0000-4000-a000-000000000999",
          name: account.name,
          type: account.type,
          source: "manual",
          ...(account.creditLimitCents !== null
            ? { creditLimitCents: account.creditLimitCents }
            : {}),
          ...(account.closingDay !== null ? { closingDay: account.closingDay } : {}),
          ...(account.dueDay !== null ? { dueDay: account.dueDay } : {}),
        },
        actor,
      );
      accountIds.set(account.id, created.id);
    }
    for (const batch of data.batches) {
      const accountId = accountIds.get(batch.accountId!)!;
      const created = await store.batches.create(
        { source: "ofx", initiatedBy: "system", accountId },
        actor,
      );
      const rows: IncomingTx[] = data.transactions
        .filter((t) => t.batchId === batch.id)
        .map((t) => ({
          accountId,
          source: "ofx",
          externalId: t.externalId!,
          amountCents: t.amountCents,
          bookedOn: t.bookedOn,
          descriptionOriginal: t.descriptionOriginal,
          status: "posted",
          nature: t.nature,
          ...(t.installment ? { installment: t.installment } : {}),
          ...(t.original ? { original: t.original } : {}),
        }));
      const result = await store.transactions.upsertMany(created.id, rows, actor);
      expect(result.rejected).toBe(0);
      await store.batches.finish(created.id, "completed", actor);
    }

    const expected: Record<string, number> = {};
    for (const t of ds.transactions)
      expected[t.date.slice(0, 7)] = (expected[t.date.slice(0, 7)] ?? 0) + t.amountCents;
    expect(await monthlySums(store)).toEqual(expected);
  }, 120_000);
});
