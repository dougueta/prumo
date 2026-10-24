/**
 * Destino após entrar (FR-006; contracts/auth-flows.md §3): só caminho interno do app, fora das
 * rotas de auth. Qualquer outra coisa ⇒ "/".
 */
const MAX_LENGTH = 512;

function isAuthRoute(pathname: string): boolean {
  return (
    pathname === "/entrar" ||
    pathname.startsWith("/entrar/") ||
    pathname === "/auth" ||
    pathname.startsWith("/auth/") ||
    pathname === "/desbloquear"
  );
}

export function safeNext(raw: string | null | undefined): string {
  if (!raw || raw.length > MAX_LENGTH) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  // Barra invertida vira "/" e TAB/quebra de linha são descartados pelo navegador:
  // "/\evil" e "/\t/evil" virariam "//evil" (protocol-relative).
  if (/[\\\u0000-\u001f\u007f]/.test(raw)) return "/";
  if (raw.includes("://")) return "/";
  if (isAuthRoute(raw.split(/[?#]/)[0])) return "/";
  return raw;
}
