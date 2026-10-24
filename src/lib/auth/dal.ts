import "server-only";
import { headers } from "next/headers";
import { cache } from "react";
import { createCoreStore } from "@/data/core";
import { loadEnv } from "@/lib/env";
import { createServiceClient } from "@/lib/supabase/server";
import { nextCookieJar } from "./cookie-jar";
import { createDal, type Dal } from "./dal-core";
import { MemoryAuthStore } from "./memory-store";
import { PATH_HEADER, requestInfoFrom } from "./request";
import type { AuthService, SessionContext } from "./service";
import type { AuthStore } from "./store";
import { createAuthAdminFor, createAuthClientFor, type ServerAuthEnv } from "./supabase-clients";
import { createSupabaseAuthService } from "./supabase-service";
import { SupabaseAuthStore } from "./supabase-store";

/**
 * Data Access Layer (contracts/dal.md) ligado ao pedido do Next. É A forma de autorizar acesso a
 * dados: toda página protegida, Server Action e Route Handler chama uma destas funções — nunca só
 * o layout (teste protected-surface).
 */

function authStore(): AuthStore {
  const env = loadEnv();
  return env.APP_ENV === "preview"
    ? new MemoryAuthStore()
    : new SupabaseAuthStore(createServiceClient());
}

/** Um DAL por pedido (React cache): a sessão é verificada uma vez só. */
export const getDal = cache(async (): Promise<Dal> => {
  const env = loadEnv();
  const jar = await nextCookieJar();
  const h = await headers();
  return createDal({
    env,
    store: authStore(),
    jar,
    now: () => new Date(),
    auth: () => createAuthClientFor(env as ServerAuthEnv, jar),
    admin: () => createAuthAdminFor(env as ServerAuthEnv),
    path: () => h.get(PATH_HEADER) ?? "/",
    request: () => requestInfoFrom(h),
  });
});

/** Página: contexto, ou redireciona (entrar / desbloquear / sair). */
export async function requireSession(opts?: { allowLocked?: boolean }): Promise<SessionContext> {
  return (await getDal()).requireSession(opts);
}

/** Server Action: `{ ok:false, error }` em vez de lançar. */
export async function requireActionSession(opts?: { allowLocked?: boolean }) {
  return (await getDal()).requireActionSession(opts);
}

/** Server Action que grava: o callback só roda com sessão ativa (FR-013). */
export async function withActionSession<T>(action: (ctx: SessionContext) => Promise<T> | T) {
  return (await getDal()).withActionSession(action);
}

/** Route Handler: contexto ou a resposta de erro (401/423/503). */
export async function requireRouteSession(opts?: { allowLocked?: boolean }) {
  return (await getDal()).requireRouteSession(opts);
}

/** Cliente com o JWT do usuário (RLS) — sempre depois de verificar a sessão. */
export async function getDataClient() {
  return (await getDal()).getDataClient();
}

/**
 * AuthService do pedido. Escolha SÓ por `loadEnv().APP_ENV` (FR-026): nenhum cookie, cabeçalho ou
 * parâmetro ativa a demonstração em produção.
 */
export async function getAuthService(): Promise<AuthService> {
  const env = loadEnv();
  if (env.APP_ENV === "preview") {
    const { getDemoAuthService } = await import("./demo-service");
    return getDemoAuthService(await nextCookieJar());
  }
  return createSupabaseAuthService({
    env,
    store: authStore(),
    jar: await nextCookieJar(),
    clock: {
      now: () => new Date(),
      elapsed: () => performance.now(),
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    },
    bootstrap: async ({ ownerId, client }) => {
      await createCoreStore({ kind: "user", ownerId, client }).bootstrap();
    },
  });
}
