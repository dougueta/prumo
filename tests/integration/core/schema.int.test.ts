import { createHash } from "node:crypto";
import { readdirSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { createTestOwner, lit, sql } from "../../helpers/supabase-test";
import { seedAccount, seedBatch, sqlError, txInsertSql } from "../../helpers/core-fixtures";

// 004 · T069 — schema aplicado do zero (data-model §2; FR-004, FR-005, FR-007–FR-015, FR-021, FR-048).
const TABLES = [
  "institutions",
  "accounts",
  "transactions",
  "categories",
  "category_templates",
  "import_batches",
  "audit_log",
];
const inList = TABLES.map(lit).join(", ");

describe("migrações core", () => {
  it("existem com nome <timestamp>_core_*.sql", () => {
    const files = readdirSync("supabase/migrations").filter((f) => f.includes("_core_"));
    const kinds = files.map((f) => f.match(/^\d{14}_core_([a-z_]+)\.sql$/)?.[1]).sort();
    expect(kinds).toEqual(["audit", "functions", "rls", "schema", "seed_catalog"]);
  });
});

describe("tabelas e tipos", () => {
  it("as 7 tabelas existem em public", () => {
    const out = sql(
      `select table_name from information_schema.tables where table_schema = 'public' and table_name in (${inList}) order by 1;`,
    );
    expect(out.split("\n").sort()).toEqual([...TABLES].sort());
  });

  it("dinheiro é BIGINT, datas de negócio DATE e timestamps TIMESTAMPTZ", () => {
    const rows = sql(
      `select column_name || ':' || data_type from information_schema.columns
       where table_schema = 'public' and table_name in (${inList})
         and (column_name like '%\\_cents' or column_name in ('booked_on','opening_balance_on','reported_balance_on','period_start','period_end')
              or column_name like '%\\_at')
       order by 1;`,
    ).split("\n");
    expect(rows.length).toBeGreaterThan(10);
    for (const row of rows) {
      const [column, type] = row.split(":");
      if (column.endsWith("_cents")) expect(type, column).toBe("bigint");
      else if (column.endsWith("_at")) expect(type, column).toBe("timestamp with time zone");
      else expect(type, column).toBe("date");
    }
  });

  it("índices e unicidade do data-model existem", () => {
    const indexes = sql(
      `select indexname from pg_indexes where schemaname = 'public' and tablename in (${inList});`,
    );
    for (const name of [
      "tx_owner_date_idx",
      "tx_account_date_idx",
      "tx_batch_idx",
      "tx_category_idx",
      "tx_identity_uq",
      "accounts_source_external_uq",
      "categories_sibling_name_uq",
      "categories_system_key_uq",
      "import_batches_file_idx",
      "audit_entity_idx",
      "institutions_catalog_name_uq",
    ]) {
      expect(indexes, name).toContain(name);
    }
  });

  it("seed: 99 modelos de categoria e 11 instituições de catálogo", () => {
    expect(sql("select count(*) from public.category_templates;")).toBe("99");
    expect(sql("select count(*) from public.institutions where owner_id is null;")).toBe("11");
  });

  it("core_fp_identity(base, k) = TS fpIdentity para vetores fixos", () => {
    const vectors: [string, number][] = [
      ["a".repeat(64), 1],
      ["0123456789abcdef".repeat(4), 2],
      [createHash("sha256").update("cafe").digest("hex"), 17],
    ];
    for (const [base, k] of vectors) {
      const expected = "fp:" + createHash("sha256").update(`${base}|${k}`).digest("hex");
      expect(sql(`select public.core_fp_identity(${lit(base)}, ${k});`)).toBe(expected);
    }
  });
});

describe("CHECKs", () => {
  let owner: string;
  let account: string;
  let batch: string;

  beforeAll(async () => {
    owner = (await createTestOwner()).id;
    account = seedAccount(owner);
    batch = seedBatch(owner, { source: "csv" });
  });

  it("conta: só BRL, last4 com 4 dígitos, campos de cartão só em cartão", () => {
    const base = `insert into public.accounts (owner_id, institution_id, name, type, source`;
    const inst = "'00000000-0000-4000-a000-000000000999'";
    expect(
      sqlError(
        `${base}, currency) values (${lit(owner)}, ${inst}, 'X', 'checking', 'manual', 'USD');`,
      ),
    ).toMatch(/check constraint/);
    expect(
      sqlError(
        `${base}, last4) values (${lit(owner)}, ${inst}, 'X', 'checking', 'manual', '12a4');`,
      ),
    ).toMatch(/check constraint/);
    expect(
      sqlError(`${base}, due_day) values (${lit(owner)}, ${inst}, 'X', 'checking', 'manual', 10);`),
    ).toMatch(/check constraint/);
    expect(
      sqlError(`${base}) values (${lit(owner)}, ${inst}, 'X', 'checking', 'pluggy');`),
    ).toMatch(/check constraint/);
  });

  it("transação: coerência de identidade ext:/man:, parcelas, exclusão e categoria", () => {
    const tx = (seed: Parameters<typeof txInsertSql>[2]) =>
      sqlError(txInsertSql(owner, account, seed));
    // ext: incoerente com external_id
    expect(tx({ batchId: batch, externalId: "X1", identityKey: "ext:X2" })).toMatch(
      /check constraint/,
    );
    // id externo sem chave ext:
    expect(tx({ batchId: batch, externalId: "X1", identityKey: "fp:" + "a".repeat(64) })).toMatch(
      /check constraint/,
    );
    // man: só para manual
    expect(tx({ batchId: batch, identityKey: "man:6f1c1f0e-0d51-4a43-9a0c-4c4a3a4b7d10" })).toMatch(
      /check constraint/,
    );
    // formato inválido
    expect(tx({ batchId: batch, identityKey: "fp:xyz" })).toMatch(/check constraint/);
    // parcela n > m
    expect(tx({ batchId: batch, extra: { installment_number: 4, installment_total: 3 } })).toMatch(
      /check constraint/,
    );
    // motivo merged sem sobrevivente
    expect(
      tx({
        batchId: batch,
        extra: { deleted_at: "2026-09-12T00:00:00Z", deleted_reason: "merged" },
      }),
    ).toMatch(/check constraint|core\./);
    // categoria sem origem
    expect(tx({ batchId: batch, categorySource: "ai" })).toMatch(/check constraint/);
    // moeda original BRL
    expect(
      tx({ batchId: batch, extra: { original_currency: "BRL", original_amount_minor: 100 } }),
    ).toMatch(/check constraint/);
    // data fora de 1900–2100
    expect(tx({ batchId: batch, bookedOn: "2101-01-01" })).toMatch(/check constraint/);
  });

  it("unicidade (conta, origem, identidade) inclui excluídas; mesmo id em outra conta é permitido", () => {
    const other = seedAccount(owner);
    sql(txInsertSql(owner, account, { batchId: batch, externalId: "DUP-1" }));
    expect(sqlError(txInsertSql(owner, account, { batchId: batch, externalId: "DUP-1" }))).toMatch(
      /tx_identity_uq/,
    );
    sql(txInsertSql(owner, other, { batchId: batch, externalId: "DUP-1" }));
  });
});
