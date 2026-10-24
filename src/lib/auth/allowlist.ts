/** Lista de autorizados (FR-001). Puro: a lista vem de `loadEnv().AUTH_ALLOWED_EMAILS`. */

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isAllowed(email: string, allowlist: readonly string[]): boolean {
  const normalized = normalizeEmail(email);
  return normalized !== "" && allowlist.includes(normalized);
}
