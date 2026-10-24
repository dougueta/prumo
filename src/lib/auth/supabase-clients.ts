import "server-only";
import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest, NextResponse } from "next/server";
import { loadEnv, type AppEnv } from "@/lib/env";
import { authCookieOptions } from "./cookie-options";

/**
 * Clientes Supabase Auth com a chave publicável e a sessão do usuário em cookies (R-02: nada de
 * cliente no navegador). Toda gravação de cookie passa por `authCookieOptions()` — as opções que
 * a biblioteca sugere (domínio, SameSite, validade…) são descartadas (FR-023).
 */

type CookieJar = {
  getAll(): Array<{ name: string; value: string }>;
  set(name: string, value: string, options: ReturnType<typeof authCookieOptions>): void;
};

export function authCookieMethods(
  appEnv: AppEnv,
  jar: CookieJar,
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

function serverEnv() {
  const env = loadEnv();
  if (env.APP_ENV === "preview") throw new Error("Modo demonstração não tem Supabase (ADR 0006).");
  return env;
}

/** Server Actions e Route Handlers (`cookies()` do Next). Em Server Components, gravar é no-op. */
export async function createAuthClient(): Promise<SupabaseClient> {
  const env = serverEnv();
  const { cookies } = await import("next/headers");
  const store = await cookies();
  const jar: CookieJar = {
    getAll: () => store.getAll(),
    set: (name, value, options) => {
      try {
        store.set(name, value, options);
      } catch {
        // Server Component: cookies são só leitura (Next 16). O proxy já renovou os tokens.
      }
    },
  };
  return createServerClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    cookies: authCookieMethods(env.APP_ENV, jar, () => {}),
  });
}

/**
 * Proxy: lê do pedido e grava na resposta. `response.current` pode ser trocada pelo chamador
 * (padrão `@supabase/ssr`: recriar `NextResponse.next({ request })` após atualizar o pedido).
 */
export function createProxyAuthClient(
  request: NextRequest,
  response: { current: NextResponse },
): SupabaseClient {
  const env = serverEnv();
  const jar: CookieJar = {
    getAll: () => request.cookies.getAll(),
    set: (name, value, options) => {
      request.cookies.set(name, value);
      response.current.cookies.set(name, value, options);
    },
  };
  return createServerClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    cookies: authCookieMethods(env.APP_ENV, jar, (key, value) =>
      response.current.headers.set(key, value),
    ),
  });
}
