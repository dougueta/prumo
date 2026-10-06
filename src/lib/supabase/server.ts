import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadEnv } from "@/lib/env";

/** Cliente Supabase de servidor (chave secreta). Nunca importar em código de cliente. */
export function createServerClient(): SupabaseClient {
  const env = loadEnv();
  if (env.APP_ENV === "preview") {
    throw new Error("Modo demonstração não tem banco (ADR 0006).");
  }
  return createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
