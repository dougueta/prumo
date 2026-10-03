// Grava SUPABASE_URL/SUPABASE_SECRET_KEY do Supabase local em $GITHUB_ENV (ou imprime, fora do CI).
// A chave é local e efêmera, mas mesmo assim é mascarada no log do Actions.
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
if (!url || !secret) {
  console.error("API_URL/SECRET_KEY ausentes em `supabase status -o env`.");
  process.exit(1);
}

console.log(`::add-mask::${secret}`);
const lines = `SUPABASE_URL=${url}
SUPABASE_SECRET_KEY=${secret}
`;
if (process.env.GITHUB_ENV) appendFileSync(process.env.GITHUB_ENV, lines);
else process.stdout.write(lines);
