import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import {
  anonClient,
  createTestOwner,
  serviceClient,
  sql,
  userClient,
  type TestOwner,
} from "../../helpers/supabase-test";
import { seedAccount, seedBatch, seedCategory, seedTx } from "../../helpers/core-fixtures";

// 004 · T034/T035 — RLS, privilégios e resolução de dono (FR-001–FR-003, SC-003).
const OWNED = ["accounts", "transactions", "categories", "import_batches", "audit_log"] as const;
const ALL = [...OWNED, "institutions", "category_templates"] as const;

type Seeded = { owner: TestOwner; account: string; tx: string; category: string; batch: string };

function seedOwner(owner: TestOwner): Seeded {
  const account = seedAccount(owner.id);
  const batch = seedBatch(owner.id, { source: "csv" });
  const category = seedCategory(owner.id, { name: "Feira", kind: "expense" });
  const tx = seedTx(owner.id, account, { batchId: batch });
  sql(
    `insert into public.institutions (owner_id, name, kind) values ('${owner.id}', 'Banco Próprio ${owner.id.slice(0, 8)}', 'bank');`,
  );
  return { owner, account, tx, category, batch };
}

let a: Seeded;
let b: Seeded;
let clientA: SupabaseClient;

beforeAll(async () => {
  a = seedOwner(await createTestOwner());
  b = seedOwner(await createTestOwner());
  clientA = await userClient(a.owner);
});

describe("RLS com JWT (dono A × dono B)", () => {
  it.each(OWNED)("SELECT em %s só devolve linhas do dono", async (table) => {
    const { data, error } = await clientA.from(table).select("owner_id");
    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
    expect(new Set(data!.map((row) => row.owner_id))).toEqual(new Set([a.owner.id]));
  });

  it("catálogo de instituições e modelos de categoria são legíveis; instituições de B não", async () => {
    const { data: institutions } = await clientA.from("institutions").select("owner_id");
    const owners = new Set(institutions!.map((row) => row.owner_id));
    expect(owners.has(null)).toBe(true);
    expect(owners.has(a.owner.id)).toBe(true);
    expect(owners.has(b.owner.id)).toBe(false);
    const { count } = await clientA
      .from("category_templates")
      .select("*", { count: "exact", head: true });
    expect(count).toBe(99);
  });

  it("INSERT com owner_id alheio é recusado", async () => {
    const { error } = await clientA.from("categories").insert({
      owner_id: b.owner.id,
      name: "Intrusa",
      kind: "expense",
      origin: "custom",
    });
    expect(error).not.toBeNull();
  });

  it("UPDATE em linha alheia afeta 0 linhas", async () => {
    const { data, error } = await clientA
      .from("transactions")
      .update({ notes: "invasão" })
      .eq("id", b.tx)
      .select("id");
    expect(error).toBeNull();
    expect(data).toEqual([]);
    expect(sql(`select coalesce(notes, '') from public.transactions where id = '${b.tx}';`)).toBe(
      "",
    );
  });

  it("DELETE é negado mesmo nas próprias linhas", async () => {
    // eslint-disable-next-line no-restricted-syntax -- o teste prova que o DELETE é negado (FR-037)
    const { error } = await clientA.from("transactions").delete().eq("id", a.tx);
    expect(error).not.toBeNull();
    expect(sql(`select count(*) from public.transactions where id = '${a.tx}';`)).toBe("1");
  });

  it("anon não lê nenhuma tabela core", async () => {
    for (const table of ALL) {
      const { data, error } = await anonClient().from(table).select("*").limit(1);
      expect(error ?? (data && data.length === 0 ? "vazio" : null), table).not.toBeNull();
    }
  });
});

describe("privilégios (matriz do data-model §3)", () => {
  const priv = (role: string, table: string, p: string) =>
    sql(`select has_table_privilege('${role}', 'public.${table}', '${p}');`);

  it.each(ALL)(
    "%s: sem DELETE/TRUNCATE para authenticated/service_role; anon sem nada",
    (table) => {
      for (const role of ["authenticated", "service_role"]) {
        expect(priv(role, table, "DELETE"), `${role} DELETE`).toBe("f");
        expect(priv(role, table, "TRUNCATE"), `${role} TRUNCATE`).toBe("f");
        expect(priv(role, table, "SELECT"), `${role} SELECT`).toBe("t");
      }
      for (const p of ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE"]) {
        expect(priv("anon", table, p), `anon ${p}`).toBe("f");
      }
    },
  );

  it("anon sem EXECUTE em funções core_*; funções de trigger sem EXECUTE para a API", () => {
    const anonExec = sql(
      `select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname like 'core\\_%' and has_function_privilege('anon', p.oid, 'EXECUTE');`,
    );
    expect(anonExec).toBe("0");
    const triggerExec = sql(
      `select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname like 'core\\_%' and p.prorettype = 'trigger'::regtype
         and (has_function_privilege('authenticated', p.oid, 'EXECUTE')
              or has_function_privilege('service_role', p.oid, 'EXECUTE'));`,
    );
    expect(triggerExec).toBe("0");
    expect(
      sql(
        `select has_function_privilege('anon', 'public.core_upsert_transactions(uuid,jsonb,uuid,jsonb)', 'EXECUTE');`,
      ),
    ).toBe("f");
  });

  it("RLS habilitado e forçado nas 7 tabelas; premissa de BYPASSRLS do postgres", () => {
    const rls = sql(
      `select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relname in (${ALL.map((t) => `'${t}'`).join(",")})
         and c.relrowsecurity and c.relforcerowsecurity;`,
    );
    expect(rls).toBe("7");
    const premise = sql(
      `select (select rolbypassrls from pg_roles where rolname = 'postgres')
          or exists (select 1 from pg_policies where tablename = 'audit_log' and 'postgres' = any(roles));`,
    );
    expect(premise).toBe("t");
  });
});

describe("core_resolve_owner (T035)", () => {
  it("JWT: devolve o próprio dono e rejeita p_owner_id divergente como not_found", async () => {
    const own = await clientA.rpc("core_resolve_owner", { p_owner_id: null });
    expect(own.data).toBe(a.owner.id);
    const same = await clientA.rpc("core_resolve_owner", { p_owner_id: a.owner.id });
    expect(same.data).toBe(a.owner.id);
    const other = await clientA.rpc("core_resolve_owner", { p_owner_id: b.owner.id });
    expect(other.error?.message).toBe("core.not_found");
  });

  it("chave secreta exige p_owner_id; sem nenhum ⇒ owner_required", async () => {
    const service = serviceClient();
    const ok = await service.rpc("core_resolve_owner", { p_owner_id: b.owner.id });
    expect(ok.data).toBe(b.owner.id);
    const missing = await service.rpc("core_resolve_owner", { p_owner_id: null });
    expect(missing.error?.message).toBe("core.owner_required");
  });
});
