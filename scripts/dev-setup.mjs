// Sobe o Supabase local (aplica migrações) e escreve .env.local para APP_ENV=local.
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const run = (cmd) => execSync(cmd, { stdio: ["ignore", "pipe", "inherit"] }).toString();

try {
  run("supabase --version");
} catch {
  console.error("Supabase CLI não encontrado. Veja README#início-rápido.");
  process.exit(1);
}

console.log("Subindo Supabase local (requer Docker Desktop aberto)...");
execSync("supabase start", { stdio: "inherit" });

const status = Object.fromEntries(
  run("supabase status -o env")
    .split(/\r?\n/)
    .map((line) => line.match(/^([A-Z_]+)="?(.*?)"?$/))
    .filter(Boolean)
    .map(([, key, value]) => [key, value]),
);

const url = status.API_URL;
const secret = status.SECRET_KEY ?? status.SERVICE_ROLE_KEY;
const publishable = status.PUBLISHABLE_KEY ?? status.ANON_KEY;
if (!url || !secret || !publishable) {
  console.error(
    "Não foi possível ler API_URL/SECRET_KEY/PUBLISHABLE_KEY de `supabase status -o env`.",
  );
  process.exit(1);
}

// 006: reexecutar não troca a allowlist nem o segredo de hash já escolhidos.
const previous = existsSync(".env.local")
  ? Object.fromEntries(
      readFileSync(".env.local", "utf-8")
        .split(/\r?\n/)
        .map((line) => line.match(/^([A-Z_]+)=(.*)$/))
        .filter(Boolean)
        .map(([, key, value]) => [key, value]),
    )
  : {};

writeFileSync(
  ".env.local",
  [
    "# Gerado por npm run dev:setup — NÃO versionar",
    "APP_ENV=local",
    `SUPABASE_URL=${url}`,
    `SUPABASE_SECRET_KEY=${secret}`,
    `SUPABASE_PUBLISHABLE_KEY=${publishable}`,
    "# 006: e-mail(s) que podem entrar. O código chega no Mailpit (http://127.0.0.1:57324).",
    `AUTH_ALLOWED_EMAILS=${previous.AUTH_ALLOWED_EMAILS || "doug@example.test"}`,
    `AUTH_HASH_SECRET=${previous.AUTH_HASH_SECRET || randomBytes(32).toString("hex")}`,
    "APP_ORIGIN=http://localhost:3000",
    "",
  ].join("\n"),
);
console.log(".env.local escrito. Rode: npm run dev");
