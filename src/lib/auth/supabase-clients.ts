import "server-only";
import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest, NextResponse } from "next/server";
import { loadEnv, type AppEnv, type Env } from "@/lib/env";
import type { CookieJar } from "./cookie-jar";
import { nextCookieJar } from "./cookie-jar";
import { authCookieOptions } from "./cookie-options";

/**
 * Clientes Supabase Auth com a chave publicável e a sessão do usuário em cookies (R-02: nada de
 * cliente no navegador). Toda gravação de cookie passa por `authCookieOptions()` — as opções que
 * a biblioteca sugere (domínio, SameSite, validade…) são descartadas (FR-023).
 */

/** Ambiente com Supabase (local e produção). */
export type ServerAuthEnv = Exclude<Env, { APP_ENV: "preview" }>;

export function authCookieMethods(
  appEnv: AppEnv,
  jar: Pick<CookieJar, "getAll" | "set">,
  setHeader: (key: string, value: string) => void,
): CookieMethodsServer {
  return {
    getAll: () => jar.getAll().map(({ name, value }) => ({ name, value })),
    setAll(cookies, headers) {
      for (const { name, value, options } of cookies) {
        jar.set(name, value, authCookieOptions(appEnv, { maxAge: options.maxAge }));
      }
      for (const [key, value] of Object.entries(headers ?? {})) setHeader(key, value);
    },
  };
}

export function serverAuthEnv(): ServerAuthEnv {
  const env = loadEnv();
  if (env.APP_ENV === "preview") throw new Error("Modo demonstração não tem Supabase (ADR 0006).");
  return env;
}

/** Cliente do usuário (chave publicável + sessão nos cookies do jar). */
export function createAuthClientFor(
  env: ServerAuthEnv,
  jar: Pick<CookieJar, "getAll" | "set">,
  setHeader: (key: string, value: string) => void = () => {},
): SupabaseClient {
  return createServerClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    cookies: authCookieMethods(env.APP_ENV, jar, setHeader),
  });
}

/**
 * Cliente sem estado (chave publicável, sem cookies, sem PKCE): pedir o código por e-mail não cria
 * sessão e não pode deixar rastro em Set-Cookie (FR-002).
 */
export function createStatelessAuthClientFor(env: ServerAuthEnv): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, flowType: "implicit" },
  });
}

/** Admin API do Auth (chave secreta): revogar sessões no provedor. Nunca toca cookies. */
export function createAuthAdminFor(env: ServerAuthEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).auth.admin;
}

/** Server Actions e Route Handlers (`cookies()` do Next). Em Server Components, gravar é no-op. */
export async function createAuthClient(): Promise<SupabaseClient> {
  return createAuthClientFor(serverAuthEnv(), await nextCookieJar());
}

/**
 * Proxy: lê do pedido e grava na resposta. `response.current` pode ser trocada pelo chamador
 * (padrão `@supabase/ssr`: recriar `NextResponse.next({ request })` após atualizar o pedido).
 */
export function createProxyAuthClient(
  request: NextRequest,
  response: { current: NextResponse },
): SupabaseClient {
  return createAuthClientFor(
    serverAuthEnv(),
    {
      getAll: () => request.cookies.getAll(),
      set: (name, value, options) => {
        request.cookies.set(name, value);
        response.current.cookies.set(name, value, options);
      },
    },
    (key, value) => response.current.headers.set(key, value),
  );
}
