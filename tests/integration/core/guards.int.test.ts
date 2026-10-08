import { beforeAll, describe, expect, it } from "vitest";
import { createTestOwner, lit, sql } from "../../helpers/supabase-test";
import {
  seedAccount,
  seedBatch,
  seedCategory,
  seedTx,
  sqlError,
  txInsertSql,
} from "../../helpers/core-fixtures";

// 004 · T027 — guarda de INSERT de transações (FR-014, FR-015, FR-021; data-model §2.6).
let owner: string;
let account: string;
let batch: string;

beforeAll(async () => {
  owner = (await createTestOwner()).id;
  account = seedAccount(owner);
  batch = seedBatch(owner, { source: "csv" });
});

describe("transactions_guard em INSERT", () => {
  it("importada sem lote é recusada", () => {
    expect(sqlError(txInsertSql(owner, account, { source: "csv", batchId: null }))).toMatch(
      /check constraint|core\./,
    );
  });

  it("lote de outra origem é recusado", () => {
    const ofx = seedBatch(owner, { source: "ofx" });
    expect(sqlError(txInsertSql(owner, account, { source: "csv", batchId: ofx }))).toMatch(
      /core\.validation:batchId/,
    );
  });

  it.each(["in_review", "completed", "failed", "undone"])(
    "lote em %s é recusado (batch_closed)",
    (status) => {
      const closed = seedBatch(owner, { source: "csv", status });
      expect(sqlError(txInsertSql(owner, account, { batchId: closed }))).toMatch(
        /core\.forbidden:batch_closed/,
      );
    },
  );

  it("conta arquivada é recusada", () => {
    const archived = seedAccount(owner, { archived: true });
    expect(sqlError(txInsertSql(owner, archived, { batchId: batch }))).toMatch(
      /core\.validation:accountId/,
    );
  });

  it("identity_key fora do formato ou ext: incoerente é recusada", () => {
    expect(sqlError(txInsertSql(owner, account, { batchId: batch, identityKey: "abc" }))).toMatch(
      /check constraint/,
    );
    expect(
      sqlError(
        txInsertSql(owner, account, { batchId: batch, externalId: "E1", identityKey: "ext:E2" }),
      ),
    ).toMatch(/check constraint/);
  });

  it("moeda original BRL é recusada", () => {
    expect(
      sqlError(
        txInsertSql(owner, account, {
          batchId: batch,
          extra: { original_currency: "BRL", original_amount_minor: 1000 },
        }),
      ),
    ).toMatch(/check constraint/);
  });

  it("relacionada excluída é recusada", () => {
    const deleted = seedTx(owner, account);
    sql(
      `update public.transactions set deleted_at = now(), deleted_reason = 'user' where id = ${lit(deleted)};`,
    );
    expect(sqlError(txInsertSql(owner, account, { relatedId: deleted }))).toMatch(
      /core\.validation:relatedTransactionId/,
    );
  });

  it("categoria 'Sem categoria' é gravada como NULL", () => {
    const uncategorized = seedCategory(owner, {
      name: "Sem categoria",
      systemKey: "uncategorized",
    });
    const id = seedTx(owner, account, {
      batchId: batch,
      categoryId: uncategorized,
      categorySource: "rule",
    });
    expect(
      sql(
        `select coalesce(category_id::text, 'null') || '|' || coalesce(category_source, 'null') from public.transactions where id = ${lit(id)};`,
      ),
    ).toBe("null|null");
  });

  it("importada nasce sem campos travados", () => {
    const id = seedTx(owner, account, {
      batchId: batch,
      extra: { locked_fields: "{description}" },
    });
    expect(sql(`select locked_fields::text from public.transactions where id = ${lit(id)};`)).toBe(
      "{}",
    );
  });
});
