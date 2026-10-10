import { execSync, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * 004 · T003 (research R-15) — utilitários dos testes de integração contra o Supabase local/CI.
 * Lê credenciais do ambiente (CI: scripts/ci-supabase-env.mjs), de `.env.local` ou de
 * `supabase status -o env`. Nunca usado por código de produção (fora de src/).
 *
 * Isolamento: como DELETE/TRUNCATE são proibidos nas tabelas core (FR-037), cada teste cria
 * donos novos (`createTestOwner`) em vez de limpar tabelas.
 */

type LocalSupabase = { url: string; secretKey: string; publishableKey: string; dbUrl: string };

let cached: LocalSupabase | undefined;

function fromStatus(): Record<string, string> {
  try {
    return Object.fromEntries(
      execSync("supabase status -o env", { stdio: ["ignore", "pipe", "ignore"] })
        .toString()
        .split(/\r?\n/)
        .map((line) => line.match(/^([A-Z_]+)="?(.*?)"?$/))
        .filter((m): m is RegExpMatchArray => m !== null)
        .map(([, key, value]) => [key, value]),
    );
  } catch {
    return {};
  }
}

function fromEnvLocal(): Record<string, string> {
  try {
    return Object.fromEntries(
      readFileSync(".env.local", "utf-8")
        .split(/\r?\n/)
        .map((line) => line.match(/^([A-Z_]+)=(.*)$/))
        .filter((m): m is RegExpMatchArray => m !== null)
        .map(([, key, value]) => [key, value]),
    );
  } catch {
    return {};
  }
}

export function localSupabase(): LocalSupabase {
  if (cached) return cached;
  const env = { ...fromEnvLocal(), ...process.env } as Record<string, string | undefined>;
  let url = env.SUPABASE_URL;
  let secretKey = env.SUPABASE_SECRET_KEY;
  let publishableKey = env.SUPABASE_PUBLISHABLE_KEY;
  let dbUrl = env.SUPABASE_DB_URL;
  if (!url || !secretKey || !publishableKey || !dbUrl) {
    const status = fromStatus();
    url ??= status.API_URL;
    secretKey ??= status.SECRET_KEY ?? status.SERVICE_ROLE_KEY;
    publishableKey ??= status.PUBLISHABLE_KEY ?? status.ANON_KEY;
    dbUrl ??= status.DB_URL;
  }
  if (!url || !secretKey || !publishableKey || !dbUrl) {
    throw new Error("Sem Supabase local: rode `npm run dev:setup` (Docker) ou use o CI.");
  }
  cached = { url, secretKey, publishableKey, dbUrl };
  process.env.SUPABASE_URL ??= url;
  process.env.SUPABASE_SECRET_KEY ??= secretKey;
  return cached;
}

const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } } as const;

/** Cliente com a chave secreta (papel service_role: ignora RLS). */
export function serviceClient(): SupabaseClient {
  const { url, secretKey } = localSupabase();
  return createClient(url, secretKey, clientOptions);
}

export type TestOwner = { id: string; email: string; password: string };

/** Cria um dono sintético pela Admin API (e-mail `owner-<uuid>@example.test`). */
export async function createTestOwner(): Promise<TestOwner> {
  const email = `owner-${randomUUID()}@example.test`;
  const password = `pw-${randomUUID()}`;
  const { data, error } = await serviceClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createUser falhou: ${error?.message}`);
  return { id: data.user.id, email, password };
}

/** Cliente autenticado como o dono (JWT → RLS ativo). */
export async function userClient(owner: TestOwner): Promise<SupabaseClient> {
  const { url, publishableKey } = localSupabase();
  const client = createClient(url, publishableKey, clientOptions);
  const { error } = await client.auth.signInWithPassword({
    email: owner.email,
    password: owner.password,
  });
  if (error) throw new Error(`login falhou: ${error.message}`);
  return client;
}

/** Cliente anônimo (só a chave publicável, sem sessão). */
export function anonClient(): SupabaseClient {
  const { url, publishableKey } = localSupabase();
  return createClient(url, publishableKey, clientOptions);
}

export type SqlResult = { ok: boolean; out: string; err: string };

function hasPsql(): boolean {
  return spawnSync("psql", ["--version"], { stdio: "ignore" }).status === 0;
}

/**
 * Executa SQL como `postgres` (psql do host; senão `docker exec` no contêiner do Supabase local).
 * `-v ON_ERROR_STOP=1`: o primeiro erro aborta e é devolvido em `err`.
 */
export function sqlTry(query: string): SqlResult {
  const { dbUrl } = localSupabase();
  const args = ["-X", "-q", "-At", "-v", "ON_ERROR_STOP=1"];
  const run = hasPsql()
    ? spawnSync("psql", [dbUrl, ...args], { input: query, encoding: "utf-8" })
    : spawnSync(
        "docker",
        ["exec", "-i", "supabase_db_prumo", "psql", "-U", "postgres", "-d", "postgres", ...args],
        { input: query, encoding: "utf-8" },
      );
  return { ok: run.status === 0, out: (run.stdout ?? "").trim(), err: (run.stderr ?? "").trim() };
}

/** Como `sqlTry`, mas lança em erro. */
export function sql(query: string): string {
  const result = sqlTry(query);
  if (!result.ok) throw new Error(`SQL falhou: ${result.err}`);
  return result.out;
}

/** Literal SQL seguro para textos de teste (sem dados reais). */
export function lit(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

/** Bloco SQL que executa `body` como o dono via JWT (papel authenticated), opcionalmente com ator. */
export function asOwnerSql(ownerId: string, body: string, actor?: object): string {
  const claims = JSON.stringify({ sub: ownerId, role: "authenticated" });
  const actorSql = actor ? `set local prumo.actor = ${lit(JSON.stringify(actor))};` : "";
  return `begin;
set local role authenticated;
set local request.jwt.claims = ${lit(claims)};
${actorSql}
${body}
commit;`;
}
