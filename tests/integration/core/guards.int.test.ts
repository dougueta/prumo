import { beforeAll, describe, expect, it } from "vitest";
import { asOwnerSql, createTestOwner, lit, sql, userClient } from "../../helpers/supabase-test";
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

// 004 · T033 — guarda de UPDATE (R-07, FR-024): PostgREST com JWT trava; ator IA respeita trava.
describe("transactions_guard em UPDATE", () => {
  it("UPDATE direto via PostgREST com JWT trava o campo (ator padrão user)", async () => {
    const user = await createTestOwner();
    const userAccount = seedAccount(user.id);
    const id = seedTx(user.id, userAccount, { batchId: seedBatch(user.id) });
    const client = await userClient(user);
    const { data, error } = await client
      .from("transactions")
      .update({ description: "Feira do sábado" })
      .eq("id", id)
      .select("description, locked_fields, description_original");
    expect(error).toBeNull();
    expect(data![0]).toMatchObject({
      description: "Feira do sábado",
      locked_fields: ["description"],
      description_original: "CAFE FICTICIO",
    });
    const audit = sql(
      `select actor_type || '|' || action from public.audit_log where entity_id = ${lit(id)} order by id desc limit 1;`,
    );
    expect(audit).toBe("user|update");
  });

  it('prumo.actor={"type":"ai"} em campo travado mantém o valor', () => {
    const id = seedTx(owner, account, { batchId: seedBatch(owner) });
    sql(
      asOwnerSql(
        owner,
        `update public.transactions set description = 'Minha' where id = ${lit(id)};`,
      ),
    );
    sql(
      asOwnerSql(
        owner,
        `update public.transactions set description = 'Da IA', notes = 'nota IA' where id = ${lit(id)};`,
        { type: "ai" },
      ),
    );
    expect(
      sql(`select description || '|' || notes from public.transactions where id = ${lit(id)};`),
    ).toBe("Minha|nota IA");
  });

  it("posted → pending ⇒ core.forbidden:status_regression", () => {
    const id = seedTx(owner, account, { batchId: seedBatch(owner), status: "posted" });
    expect(
      sqlError(`update public.transactions set status = 'pending' where id = ${lit(id)};`),
    ).toMatch(/core\.forbidden:status_regression/);
  });

  it("usuário não altera fato de importada (imported_fact)", () => {
    const id = seedTx(owner, account, { batchId: seedBatch(owner) });
    expect(
      sqlError(
        asOwnerSql(
          owner,
          `update public.transactions set amount_cents = -1 where id = ${lit(id)};`,
        ),
      ),
    ).toMatch(/core\.forbidden:imported_fact/);
  });
});
