import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadEnv, type Env } from "@/lib/env";

/**
 * Único ponto de criação do cliente com a chave secreta (006 · contracts/dal.md). Importável só em
 * src/lib/auth/**, src/app/api/health/route.ts e src/data/** (teste protected-surface).
 * `env` explícito só para testes de contrato; o app usa `loadEnv()`.
 */
export function createServiceClient(env: Env = loadEnv()): SupabaseClient {
  if (env.APP_ENV === "preview") {
    throw new Error("Modo demonstração não tem banco (ADR 0006).");
  }
  return createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
