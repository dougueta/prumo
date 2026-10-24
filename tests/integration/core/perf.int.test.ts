import { describe, expect, it } from "vitest";
import { createCoreStore } from "@/data/core";
import { createTestOwner, lit, serviceClient, sql } from "../../helpers/supabase-test";
import { IMPORT, incoming, manualAccount, newBatch } from "../../contract/helpers";

// 004 · T059 — desempenho com 100 mil transações (SC-007, FR-042).
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

describe("desempenho (100 mil transações)", () => {
  it("1 mês de extrato ≤ 1 s (mediana de 5), upsert de 1.000 linhas ≤ 2 s e índice tx_owner_date_idx", async () => {
    const owner = (await createTestOwner()).id;
    const store = createCoreStore({ kind: "service", ownerId: owner, client: serviceClient() });
    const accounts: string[] = [];
    for (let i = 0; i < 5; i++)
      accounts.push((await manualAccount(store, { name: `Conta ${i} (simulada)` })).id);
    const batch = await newBatch(store);

    sql(`insert into public.transactions (owner_id, account_id, batch_id, source, identity_key,
           amount_cents, booked_on, description_original, status)
         select ${lit(owner)}, (array[${accounts.map(lit).join(",")}]::uuid[])[1 + g % 5],
                ${lit(batch.id)}, 'csv',
                'fp:' || encode(sha256(convert_to('perf|' || g::text, 'UTF8')), 'hex'),
                -(100 + g % 9000), date '2001-10-01' + (g % 9125), 'COMPRA SINTETICA ' || (g % 97), 'posted'
           from generate_series(1, 100000) g;
         analyze public.transactions;`);
    expect(
      Number(sql(`select count(*) from public.transactions where owner_id = ${lit(owner)};`)),
    ).toBe(100_000);

    const timings: number[] = [];
    for (let i = 0; i < 5; i++) {
      const start = performance.now();
      let cursor: string | null = null;
      do {
        const page = await store.transactions.list({
          from: "2026-09-01",
          to: "2026-09-30",
          limit: 200,
          cursor,
        });
        cursor = page.nextCursor;
      } while (cursor);
      timings.push(performance.now() - start);
    }
    expect(median(timings)).toBeLessThanOrEqual(1000);

    const plan = sql(`explain select * from public.transactions
      where owner_id = ${lit(owner)} and deleted_at is null and booked_on between '2026-09-01' and '2026-09-30'
      order by booked_on desc, id desc limit 201;`);
    expect(plan).toMatch(/tx_owner_date_idx/);

    const rows = Array.from({ length: 1000 }, (_, i) =>
      incoming(accounts[i % 5], { descriptionOriginal: `LOTE GRANDE ${i}`, amountCents: -(i + 1) }),
    );
    const upsertBatch = await newBatch(store);
    const start = performance.now();
    const result = await store.transactions.upsertMany(upsertBatch.id, rows, IMPORT);
    expect(performance.now() - start).toBeLessThanOrEqual(2000);
    expect(result.created).toBe(1000);
  }, 300_000);
});
