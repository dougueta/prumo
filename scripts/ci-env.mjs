// Ambiente dos jobs de integração e E2E (001/004/006), a partir de `supabase status -o env`.
// SUPABASE_URL/SUPABASE_SECRET_KEY: app (001). SUPABASE_PUBLISHABLE_KEY: app (006) e testes da 004.
// SUPABASE_DB_URL: só testes da 004. AUTH_*: 006 — allowlist com e-mails sintéticos e segredo de
// hash aleatório por execução (nunca dado real no CI). APP_ORIGIN: padrão do `next dev`; o
// Playwright sobrescreve para o servidor dele.
import { randomBytes } from "node:crypto";

export const CI_ALLOWED_EMAILS = ["doug@example.test", "segundo@example.test"];

export function buildCiEnv(status) {
  const url = status.API_URL;
  const secret = status.SECRET_KEY ?? status.SERVICE_ROLE_KEY;
  const publishable = status.PUBLISHABLE_KEY ?? status.ANON_KEY;
  const dbUrl = status.DB_URL;
  if (!url || !secret || !publishable || !dbUrl) {
    throw new Error(
      "API_URL/SECRET_KEY/PUBLISHABLE_KEY/DB_URL ausentes em `supabase status -o env`.",
    );
  }
  const vars = {
    SUPABASE_URL: url,
    SUPABASE_SECRET_KEY: secret,
    SUPABASE_PUBLISHABLE_KEY: publishable,
    SUPABASE_DB_URL: dbUrl,
    AUTH_ALLOWED_EMAILS: CI_ALLOWED_EMAILS.join(","),
    AUTH_HASH_SECRET: randomBytes(32).toString("hex"),
    APP_ORIGIN: "http://localhost:3000",
  };
  // Locais e efêmeros, mas mesmo assim fora do log do Actions.
  const masks = [
    secret,
    publishable,
    vars.AUTH_HASH_SECRET,
    vars.AUTH_ALLOWED_EMAILS,
    ...CI_ALLOWED_EMAILS,
  ];
  return { vars, masks };
}
