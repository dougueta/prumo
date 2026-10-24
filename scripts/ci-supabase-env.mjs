// Grava o ambiente dos testes em $GITHUB_ENV (ou imprime, fora do CI). Conteúdo: scripts/ci-env.mjs.
import { execSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { buildCiEnv } from "./ci-env.mjs";

const status = Object.fromEntries(
  execSync("supabase status -o env")
    .toString()
    .split(/\r?\n/)
    .map((line) => line.match(/^([A-Z_]+)="?(.*?)"?$/))
    .filter(Boolean)
    .map(([, key, value]) => [key, value]),
);

let env;
try {
  env = buildCiEnv(status);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

for (const value of env.masks) console.log(`::add-mask::${value}`);
const lines = Object.entries(env.vars)
  .map(([key, value]) => `${key}=${value}\n`)
  .join("");
if (process.env.GITHUB_ENV) appendFileSync(process.env.GITHUB_ENV, lines);
else process.stdout.write(lines);
