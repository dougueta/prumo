// Ambiente do modo demonstração (APP_ENV=preview): nenhuma credencial (001/004/006; FR-024, FR-026).
// O Next carrega .env.local mas não sobrescreve variáveis já definidas: vazias = ausentes. Por
// isso as conhecidas são definidas vazias mesmo que não estejam no ambiente de origem.
const KNOWN = [
  "SUPABASE_URL",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_DB_URL",
  "AUTH_ALLOWED_EMAILS",
  "AUTH_HASH_SECRET",
  "APP_ORIGIN",
];
const isCredential = (key) => /^(SUPABASE_|AUTH_)/.test(key) || key === "APP_ORIGIN";

export function buildDemoEnv(source) {
  const env = Object.fromEntries(Object.entries(source).filter(([key]) => !isCredential(key)));
  for (const key of [...KNOWN, ...Object.keys(source).filter(isCredential)]) env[key] = "";
  env.APP_ENV = "preview";
  return env;
}
