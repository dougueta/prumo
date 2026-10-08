import { beforeAll, describe, expect, it } from "vitest";
import { createTestOwner, lit, sql, sqlTry } from "../../helpers/supabase-test";
import { seedAccount, seedBatch, seedTx, sqlError } from "../../helpers/core-fixtures";

// 004 · T047 — auditoria imutável e atômica; nada apagado fisicamente (FR-036, FR-037, FR-040, SC-004).
let owner: string;
let account: string;
let tx: string;

beforeAll(async () => {
  owner = (await createTestOwner()).id;
  account = seedAccount(owner);
  tx = seedTx(owner, account, { batchId: seedBatch(owner) });
});

const asRole = (role: string, body: string) =>
  `begin; set local role ${role}; set local request.jwt.claims = ${lit(
    JSON.stringify({ sub: owner, role }),
  )}; ${body} commit;`;

describe("audit_log é somente-acréscimo", () => {
  it("INSERT de transação gerou entrada create com ator e changes", () => {
    const row = sql(
      `select action || '|' || actor_type || '|' || (changes ? 'amount_cents')::text
       from public.audit_log where entity_type = 'transaction' and entity_id = ${lit(tx)};`,
    );
    expect(row).toBe("create|system|true");
  });

  it.each(["postgres", "service_role", "authenticated"])(
    "UPDATE/DELETE/TRUNCATE falham para %s",
    (role) => {
      const wrap = (body: string) => (role === "postgres" ? body : asRole(role, body));
      expect(
        sqlTry(
          wrap(`update public.audit_log set action = 'create' where owner_id = ${lit(owner)};`),
        ).ok,
      ).toBe(false);
      expect(sqlTry(wrap(`delete from public.audit_log where owner_id = ${lit(owner)};`)).ok).toBe(
        false,
      );
      expect(sqlTry(wrap("truncate public.audit_log;")).ok).toBe(false);
    },
  );

  it("postgres recebe core.audit_immutable", () => {
    expect(sqlError("update public.audit_log set reason = 'x';")).toMatch(/core\.audit_immutable/);
    expect(sqlError("delete from public.audit_log;")).toMatch(/core\.audit_immutable/);
    expect(sqlError("truncate public.audit_log;")).toMatch(/core\.audit_immutable/);
    expect(
      Number(sql(`select count(*) from public.audit_log where owner_id = ${lit(owner)};`)),
    ).toBeGreaterThan(0);
  });
});

describe("DELETE/TRUNCATE físico proibido", () => {
  it.each(["transactions", "accounts", "categories", "import_batches", "institutions"])(
    "DELETE em %s ⇒ core.hard_delete_forbidden",
    (table) => {
      expect(sqlError(`delete from public.${table} where owner_id = ${lit(owner)};`)).toMatch(
        /core\.hard_delete_forbidden/,
      );
    },
  );

  it("a linha continua existindo após o DELETE recusado", () => {
    sqlTry(`delete from public.transactions where id = ${lit(tx)};`);
    expect(sql(`select count(*) from public.transactions where id = ${lit(tx)};`)).toBe("1");
  });

  it.each([
    "transactions",
    "accounts",
    "categories",
    "import_batches",
    "institutions",
    "category_templates",
  ])("TRUNCATE em %s ⇒ core.hard_delete_forbidden", (table) => {
    expect(sqlError(`truncate public.${table} cascade;`)).toMatch(
      /core\.hard_delete_forbidden|core\.audit_immutable/,
    );
    expect(sql("select count(*) > 0 from public.category_templates;")).toBe("t");
  });
});

describe("atomicidade da auditoria", () => {
  it("UPDATE direto gera auditoria na mesma transação; falha posterior não deixa auditoria órfã", () => {
    const count = () =>
      Number(sql(`select count(*) from public.audit_log where entity_id = ${lit(tx)};`));
    const before = count();
    sql(`update public.transactions set notes = 'nota fictícia' where id = ${lit(tx)};`);
    expect(count()).toBe(before + 1);
    const failed = sqlTry(
      `begin; update public.transactions set notes = 'outra nota' where id = ${lit(tx)}; select 1/0; commit;`,
    );
    expect(failed.ok).toBe(false);
    expect(count()).toBe(before + 1);
    expect(sql(`select notes from public.transactions where id = ${lit(tx)};`)).toBe(
      "nota fictícia",
    );
  });

  it("changes só contém colunas alteradas (sem updated_at)", () => {
    const changes = sql(
      `select changes::text from public.audit_log where entity_id = ${lit(tx)} and action = 'update' order by id desc limit 1;`,
    );
    expect(JSON.parse(changes)).toEqual({ notes: { old: null, new: "nota fictícia" } });
  });

  it("conta no account também é auditada", () => {
    expect(
      sql(
        `select count(*) > 0 from public.audit_log where entity_type = 'account' and entity_id = ${lit(account)};`,
      ),
    ).toBe("t");
  });
});
