import { loadEnv } from "@/lib/env";

/** Valida a configuração no boot do servidor: falha imediata e clara (FR-003). */
export function register() {
  loadEnv();
}
