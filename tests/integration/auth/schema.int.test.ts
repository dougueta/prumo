import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import {
  anonClient,
  createTestOwner,
  serviceClient,
  sql,
  sqlTry,
  userClient,
  type TestOwner,
} from "../../helpers/supabase-test";

/**
 * 006 · T009 (FR-019, FR-020, FR-021) — data-model §1–§6: três tabelas com RLS + FORCE, CHECKs,
 * FKs RESTRICT, leitura só das próprias linhas, escrita só pelo servidor, eventos somente
 * inserção (salvo a rotina de retenção) e job de retenção no pg_cron.
 */
const TABLES = ["app_sessions", "webauthn_credentials", "access_events"] as const;

function seedSession(ownerId: string, overrides = ""): string {
  const id = randomUUID();
  sql(`insert into public.app_sessions (id, owner_id, device_id, method, device_label, absolute_expires_at)
       values ('${id}', '${ownerId}', '${randomUUID()}', 'email_otp', 'iPhone · Safari', now() + interval '90 days')
       ${overrides};`);
  return id;
}

function seedCredential(ownerId: string): string {
  return sql(`insert into public.webauthn_credentials (owner_id, device_id, credential_id, public_key, device_label)
       values ('${ownerId}', '${randomUUID()}', '${randomUUID()}', '\\x0102', 'iPhone · Safari') returning id;`);
}

function seedEvent(ownerId: string | null, type = "login_succeeded"): string {
  const owner = ownerId ? `'${ownerId}'` : "null";
  return sql(`insert into public.access_events (type, method, owner_id, email_hash, device_label)
       values ('${type}', 'email_otp', ${owner}, '${"a".repeat(64)}', 'iPhone · Safari') returning id;`);
}

let a: TestOwner;
let b: TestOwner;
let clientA: SupabaseClient;

beforeAll(async () => {
  a = await createTestOwner();
  b = await createTestOwner();
  for (const owner of [a, b]) {
    seedSession(owner.id);
    seedCredential(owner.id);
    seedEvent(owner.id);
  }
  seedEvent(null, "email_refused");
  clientA = await userClient(a);
});

describe("estrutura", () => {
  it.each(TABLES)("%s existe com RLS habilitada e forçada", (table) => {
    expect(
      sql(`select relrowsecurity || ',' || relforcerowsecurity from pg_class
           where oid = 'public.${table}'::regclass;`),
    ).toBe("true,true");
  });

  it.each(TABLES)("FKs de %s para auth.users são ON DELETE RESTRICT", (table) => {
    const rules = sql(`select string_agg(confdeltype::text, ',') from pg_constraint
         where conrelid = 'public.${table}'::regclass and contype = 'f'
           and confrelid = 'auth.users'::regclass;`);
    expect(rules).toBe("r");
  });

  it("job de retenção registrado no pg_cron (03:00 BRT)", () => {
    expect(sql(`select schedule from cron.job where jobname = 'prumo-auth-retention';`)).toBe(
      "0 6 * * *",
    );
  });
});

describe("CHECKs de app_sessions", () => {
  it("validade absoluta acima de 90 dias é recusada", () => {
    const r =
      sqlTry(`insert into public.app_sessions (id, owner_id, device_id, method, device_label, absolute_expires_at)
       values ('${randomUUID()}', '${a.id}', '${randomUUID()}', 'google', 'x', now() + interval '91 days');`);
    expect(r.ok).toBe(false);
  });

  it("ended_at e end_reason andam juntos", () => {
    const id = seedSession(a.id);
    expect(sqlTry(`update public.app_sessions set ended_at = now() where id = '${id}';`).ok).toBe(
      false,
    );
    expect(
      sqlTry(
        `update public.app_sessions set ended_at = now(), end_reason = 'logout' where id = '${id}';`,
      ).ok,
    ).toBe(true);
  });

  it("end_reason fora da lista é recusado", () => {
    const id = seedSession(a.id);
    expect(
      sqlTry(
        `update public.app_sessions set ended_at = now(), end_reason = 'qualquer' where id = '${id}';`,
      ).ok,
    ).toBe(false);
  });

  it("method só google ou email_otp", () => {
    const r =
      sqlTry(`insert into public.app_sessions (id, owner_id, device_id, method, device_label, absolute_expires_at)
       values ('${randomUUID()}', '${a.id}', '${randomUUID()}', 'webauthn', 'x', now() + interval '1 day');`);
    expect(r.ok).toBe(false);
  });

  it("desafio WebAuthn e sua validade andam juntos; falhas entre 0 e 5", () => {
    const id = seedSession(a.id);
    expect(
      sqlTry(`update public.app_sessions set webauthn_challenge = 'abc' where id = '${id}';`).ok,
    ).toBe(false);
    expect(
      sqlTry(`update public.app_sessions set unlock_failures = 6 where id = '${id}';`).ok,
    ).toBe(false);
  });

  it("device_id é obrigatório", () => {
    const r =
      sqlTry(`insert into public.app_sessions (id, owner_id, method, device_label, absolute_expires_at)
       values ('${randomUUID()}', '${a.id}', 'google', 'x', now() + interval '1 day');`);
    expect(r.ok).toBe(false);
  });
});

describe("acesso por papel", () => {
  it.each(TABLES)("anon não lê %s", async (table) => {
    const { data, error } = await anonClient().from(table).select("*");
    expect(error !== null || data!.length === 0).toBe(true);
  });

  it.each(TABLES)("authenticated só lê as próprias linhas de %s", async (table) => {
    const { data, error } = await clientA.from(table).select("owner_id");
    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
    expect(new Set(data!.map((row) => row.owner_id))).toEqual(new Set([a.id]));
  });

  it.each(TABLES)("authenticated não grava em %s", async (table) => {
    const { error: insertError } = await clientA.from(table).insert({ owner_id: a.id });
    expect(insertError).not.toBeNull();
    const { data } = await clientA
      .from(table)
      .update({ device_label: "x" })
      .eq("owner_id", a.id)
      .select();
    expect(data ?? []).toEqual([]);
    const { data: deleted } = await clientA.from(table).delete().eq("owner_id", a.id).select();
    expect(deleted ?? []).toEqual([]);
  });

  it("o servidor (service_role) grava sessões", async () => {
    const { error } = await serviceClient()
      .from("app_sessions")
      .update({ last_active_at: new Date().toISOString() })
      .eq("owner_id", a.id);
    expect(error).toBeNull();
  });
});

describe("access_events somente inserção (FR-021)", () => {
  it("nenhum papel faz UPDATE ou DELETE, nem o servidor", async () => {
    const id = seedEvent(a.id);
    expect(sqlTry(`update public.access_events set geo = 'x' where id = ${id};`).ok).toBe(false);
    expect(sqlTry(`delete from public.access_events where id = ${id};`).ok).toBe(false);
    const { error } = await serviceClient().from("access_events").delete().eq("id", Number(id));
    expect(error).not.toBeNull();
  });

  it("a rotina de retenção (prumo.retention = on) pode apagar", () => {
    const id = seedEvent(a.id);
    expect(
      sqlTry(
        `begin; set local prumo.retention = 'on'; delete from public.access_events where id = ${id}; commit;`,
      ).ok,
    ).toBe(true);
    expect(sql(`select count(*) from public.access_events where id = ${id};`)).toBe("0");
  });

  it("email_hash é obrigatório nos eventos que alimentam rate limit e classificação", () => {
    for (const type of [
      "otp_requested",
      "otp_failed",
      "email_refused",
      "login_blocked",
      "login_succeeded",
    ]) {
      const r = sqlTry(
        `insert into public.access_events (type, device_label) values ('${type}', 'x');`,
      );
      expect(r.ok, type).toBe(false);
    }
    expect(
      sqlTry(`insert into public.access_events (type, device_label) values ('logout', 'x');`).ok,
    ).toBe(true);
  });
});
