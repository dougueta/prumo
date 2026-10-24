import type { SupabaseClient } from "@supabase/supabase-js";
import { CoreError } from "@/domain/core/errors";
import type { OwnerId } from "@/domain/core/types";
import { getAppEnv } from "@/lib/app-env";
import type { AppEnv } from "@/lib/env";
import { DEMO_OWNER_ID, DEMO_SESSION_COOKIE } from "./constants";
import { demoSessions } from "./memory/demo-sessions";
import type { CoreStore } from "./ports";
import { SupabaseCoreStore } from "./supabase/supabase-store";

/** Contexto de dono (contracts/owner-context.md). A 006 implementa o provedor de sessão. */
export type OwnerContext =
  | { kind: "user"; ownerId: OwnerId; client: SupabaseClient } // JWT do usuário → RLS ativo
  | { kind: "service"; ownerId: OwnerId; client: SupabaseClient } // chave secreta → só servidor/jobs
  | { kind: "demo"; sessionId: string }; // memória (preview); dono = DEMO_OWNER_ID

export interface OwnerContextProvider {
  /** Devolve `user` ou `demo`. Sem sessão válida, lança CoreError("owner_required"). */
  current(): Promise<OwnerContext>;
}

export { DEMO_OWNER_ID, DEMO_SESSION_COOKIE };

let provider: OwnerContextProvider | null = null;

/** Chamado pela 006 uma vez no boot do servidor. */
export function registerOwnerContextProvider(p: OwnerContextProvider): void {
  provider = p;
}

/** Só para testes. */
export function clearOwnerContextProvider(): void {
  provider = null;
}

/** Fábrica pura: um CoreStore escopado ao dono do contexto. */
export function createCoreStore(ctx: OwnerContext): CoreStore {
  switch (ctx.kind) {
    case "user":
    case "service":
      return new SupabaseCoreStore(ctx.client, ctx.ownerId);
    case "demo":
      return demoSessions().get(ctx.sessionId);
  }
}

export type ResolveDeps = {
  appEnv: () => AppEnv;
  readDemoSessionId: () => Promise<string | undefined>;
};

export async function resolveCoreStore(deps: ResolveDeps): Promise<CoreStore> {
  if (provider) return createCoreStore(await provider.current());
  if (deps.appEnv() === "preview") {
    const sessionId = await deps.readDemoSessionId();
    // sem cookie: sessão só desta requisição
    return sessionId ? createCoreStore({ kind: "demo", sessionId }) : demoSessions().ephemeral();
  }
  throw new CoreError("owner_required");
}

async function readDemoSessionCookie(): Promise<string | undefined> {
  try {
    const { cookies } = await import("next/headers");
    return (await cookies()).get(DEMO_SESSION_COOKIE)?.value;
  } catch {
    return undefined; // fora de uma requisição do Next
  }
}

/** Store do dono da requisição corrente (provedor da 006; em preview, a sessão demo). */
export function getCoreStore(): Promise<CoreStore> {
  return resolveCoreStore({ appEnv: getAppEnv, readDemoSessionId: readDemoSessionCookie });
}
