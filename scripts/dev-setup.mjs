// Sobe o Supabase local (aplica migrações) e escreve .env.local para APP_ENV=local.
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

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
if (!url || !secret) {
  console.error("Não foi possível ler API_URL/SECRET_KEY de `supabase status -o env`.");
  process.exit(1);
}

writeFileSync(
  ".env.local",
  [
    "# Gerado por npm run dev:setup — NÃO versionar",
    "APP_ENV=local",
    `SUPABASE_URL=${url}`,
    `SUPABASE_SECRET_KEY=${secret}`,
    "",
  ].join("\n"),
);
console.log(".env.local escrito. Rode: npm run dev");
