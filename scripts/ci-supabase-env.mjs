// Grava as credenciais do Supabase local em $GITHUB_ENV (ou imprime, fora do CI).
// SUPABASE_URL/SUPABASE_SECRET_KEY: app (001). SUPABASE_PUBLISHABLE_KEY e SUPABASE_DB_URL: só
// testes de integração da 004 (clientes com JWT e SQL direto) — nunca lidas por src/.
// As chaves são locais e efêmeras, mas mesmo assim são mascaradas no log do Actions.
import { execSync } from "node:child_process";
import { appendFileSync } from "node:fs";

const status = Object.fromEntries(
  execSync("supabase status -o env")
    .toString()
    .split(/\r?\n/)
    .map((line) => line.match(/^([A-Z_]+)="?(.*?)"?$/))
    .filter(Boolean)
    .map(([, key, value]) => [key, value]),
);

const url = status.API_URL;
const secret = status.SECRET_KEY ?? status.SERVICE_ROLE_KEY;
const publishable = status.PUBLISHABLE_KEY ?? status.ANON_KEY;
const dbUrl = status.DB_URL;
if (!url || !secret || !publishable || !dbUrl) {
  console.error("API_URL/SECRET_KEY/PUBLISHABLE_KEY/DB_URL ausentes em `supabase status -o env`.");
  process.exit(1);
}

for (const value of [secret, publishable]) console.log(`::add-mask::${value}`);
const lines = `SUPABASE_URL=${url}
SUPABASE_SECRET_KEY=${secret}
SUPABASE_PUBLISHABLE_KEY=${publishable}
SUPABASE_DB_URL=${dbUrl}
`;
if (process.env.GITHUB_ENV) appendFileSync(process.env.GITHUB_ENV, lines);
else process.stdout.write(lines);
