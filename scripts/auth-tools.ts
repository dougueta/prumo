// Lógica dos scripts de auth (006 · T017). Entradas: scripts/auth-provision.ts e
// scripts/auth-age-session.ts. Nunca usados pelo app.
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { normalizeEmail } from "../src/lib/auth/allowlist";
import { maskEmail } from "../src/lib/auth/crypto";
import { parseEnv } from "../src/lib/env";

/** Só o necessário da Admin API do Supabase Auth (testável sem rede). */
export type AdminApi = {
  listUsers(params: { page: number; perPage: number }): Promise<{
    data: { users: Array<{ email?: string | null }> };
    error: unknown;
  }>;
  createUser(attrs: { email: string; email_confirm: boolean }): Promise<{ error: unknown }>;
};

const PER_PAGE = 100;

async function existingEmails(admin: AdminApi): Promise<Set<string>> {
  const emails = new Set<string>();
  for (let page = 1; ; page++) {
    const { data, error } = await admin.listUsers({ page, perPage: PER_PAGE });
    if (error) throw new Error("Admin API do Supabase Auth falhou ao listar usuários.");
    for (const user of data.users) if (user.email) emails.add(normalizeEmail(user.email));
    if (data.users.length < PER_PAGE) return emails;
  }
}

/**
 * Cria no Supabase Auth os usuários da allowlist que ainda não existem (cadastro público é
 * desligado — FR-001). Idempotente. A saída só mostra e-mails mascarados.
 */
export async function provision(
  emails: readonly string[],
  admin: AdminApi,
  log: (line: string) => void,
): Promise<void> {
  const existing = await existingEmails(admin);
  for (const email of emails.map(normalizeEmail)) {
    if (existing.has(email)) {
      log(`já existe: ${maskEmail(email)}`);
      continue;
    }
    const { error } = await admin.createUser({ email, email_confirm: true });
    if (error) throw new Error(`Admin API do Supabase Auth falhou ao criar ${maskEmail(email)}.`);
    existing.add(email);
    log(`criado: ${maskEmail(email)}`);
  }
}

export function assertLocal(appEnv: string | undefined): void {
  if (appEnv !== "local") {
    throw new Error("auth:age-session só roda com APP_ENV=local (nunca em preview/produção).");
  }
}

export type AgeArgs = { minutes: number } | { days: number };

export function parseAgeArgs(argv: readonly string[]): AgeArgs {
  const usage = "Uso: npm run auth:age-session -- --minutes N | --days N";
  if (argv.length !== 2) throw new Error(usage);
  const [flag, raw] = argv;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) throw new Error(usage);
  if (flag === "--minutes") return { minutes: value };
  if (flag === "--days") return { days: value };
  throw new Error(usage);
}

type SessionTimes = {
  created_at: string;
  absolute_expires_at: string;
  last_active_at: string;
};

const shift = (iso: string, ms: number) => new Date(new Date(iso).getTime() - ms).toISOString();

/** `--minutes`: só o último uso (bloqueio). `--days`: tudo junto (ocioso/absoluto). */
export function agePatch(row: SessionTimes, args: AgeArgs): Partial<SessionTimes> {
  if ("minutes" in args)
    return { last_active_at: shift(row.last_active_at, args.minutes * 60_000) };
  const ms = args.days * 24 * 60 * 60_000;
  return {
    created_at: shift(row.created_at, ms),
    absolute_expires_at: shift(row.absolute_expires_at, ms),
    last_active_at: shift(row.last_active_at, ms),
  };
}

// ---------------------------------------------------------------------------------------------
// Ambiente dos scripts: variáveis do processo (CI) sobre o .env.local (dev).

function envLocal(): Record<string, string> {
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

export function scriptEnv() {
  const env = parseEnv({ ...envLocal(), ...process.env });
  if (env.APP_ENV === "preview") throw new Error("Modo demonstração não tem Supabase.");
  return env;
}

export function serviceClient(): SupabaseClient {
  const env = scriptEnv();
  return createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
