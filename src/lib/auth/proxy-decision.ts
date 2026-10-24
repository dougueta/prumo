import type { AppEnv } from "@/lib/env";

/**
 * Decisão do proxy (contracts/auth-flows.md §1–§2; R-10). Checagem otimista por cookie — a
 * autorização real é do DAL. Puro: o adaptador em `src/proxy.ts` só aplica a ação.
 */

const PUBLIC_EXACT = new Set([
  "/entrar",
  "/entrar/codigo",
  "/auth/callback",
  "/auth/sair",
  "/~offline",
  "/api/health",
  "/manifest.webmanifest",
  "/sw.js",
]);

export function isPublicPath(path: string): boolean {
  return PUBLIC_EXACT.has(path) || path.startsWith("/icons/");
}

/** Cookie de sessão do `@supabase/ssr` (`sb-<ref>-auth-token`, possivelmente em pedaços `.0`, `.1`). */
export function hasSupabaseAuthCookie(names: readonly string[]): boolean {
  return names.some((name) => /^sb-.+-auth-token(\.\d+)?$/.test(name));
}

export type ProxyAction =
  | { action: "demo" } // preview: só garante prumo_demo_sid (004)
  | { action: "next" } // pública: segue sem tocar em nada
  | { action: "redirect"; location: string } // página protegida sem cookie
  | { action: "unauthorized" } // API protegida sem cookie ⇒ 401
  | { action: "refresh" }; // protegida com cookie ⇒ renova tokens + no-store

export function decideProxy({
  appEnv,
  path,
  search,
  hasAuthCookie,
}: {
  appEnv: AppEnv;
  path: string;
  search: string;
  hasAuthCookie: boolean;
}): ProxyAction {
  if (appEnv === "preview") return { action: "demo" };
  // Rota pública segue — inclusive /entrar com cookie: quem decide se a sessão vale é a página
  // (JWT ainda válido de sessão encerrada geraria laço /entrar ⇄ /).
  if (isPublicPath(path)) return { action: "next" };
  if (hasAuthCookie) return { action: "refresh" };
  if (path === "/api" || path.startsWith("/api/")) return { action: "unauthorized" };
  return { action: "redirect", location: `/entrar?next=${encodeURIComponent(path + search)}` };
}
