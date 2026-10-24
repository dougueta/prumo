/**
 * Preferências de exibição guardadas no aparelho (spec 003, data-model §3). Cookies sem dado
 * pessoal nem financeiro, lidos no servidor (root layout) para o HTML já sair no tema certo.
 */
export const THEME_COOKIE = "prumo_theme";
export const PRIVACY_COOKIE = "prumo_privacy";

export type ThemePreference = "auto" | "light" | "dark";
export type PrivacyPreference = "on" | "off";

const ONE_YEAR_SECONDS = 31_536_000;

type CookieLike = string | { value: string } | undefined;

function raw(cookie: CookieLike): string | undefined {
  return typeof cookie === "string" ? cookie : cookie?.value;
}

/** Valor inválido ou ausente → "auto" (edge case "preferências indisponíveis"). */
export function parseTheme(cookie: CookieLike): ThemePreference {
  const value = raw(cookie);
  return value === "light" || value === "dark" || value === "auto" ? value : "auto";
}

/** Valor inválido ou ausente → "off". */
export function parsePrivacy(cookie: CookieLike): PrivacyPreference {
  return raw(cookie) === "on" ? "on" : "off";
}

export function serializePreferenceCookie(
  name: string,
  value: string,
  { secure }: { secure: boolean },
): string {
  const attrs = [`${name}=${value}`, "Path=/", `Max-Age=${ONE_YEAR_SECONDS}`, "SameSite=Lax"];
  if (secure) attrs.push("Secure");
  return attrs.join("; ");
}

/**
 * Grava a preferência no cliente. Devolve `false` se o navegador bloquear cookies — a mudança
 * continua valendo na sessão (quem chama já alterou o atributo do <html>).
 */
export function setPreference(name: string, value: string): boolean {
  try {
    document.cookie = serializePreferenceCookie(name, value, {
      secure: window.location.protocol === "https:",
    });
    return true;
  } catch {
    return false;
  }
}
