import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { toCsv } from "@/synthetic/export-csv";
import { toOfx } from "@/synthetic/export-ofx";
import { generateDataset } from "@/synthetic/generate";

/** Contrato: specs/001-setup-projeto/contracts/synthetic-cli.md */

type Io = { log: (message: string) => void; error: (message: string) => void };

const DEFAULTS = {
  seed: "42",
  months: "12",
  "anchor-date": "2026-09-30",
  out: "tests/fixtures/synthetic",
  format: "json,csv,ofx",
};
type Option = keyof typeof DEFAULTS;

export function runCli(argv: string[], env: Record<string, string | undefined>, io: Io): number {
  if (env.APP_ENV === "production") {
    io.error("Recusado: o gerador não roda em produção.");
    return 2;
  }

  const options: Record<Option, string> = { ...DEFAULTS };
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, "") as Option;
    if (!(key in DEFAULTS) || argv[i + 1] === undefined) {
      io.error(`Argumento inválido: ${argv[i]}`);
      return 1;
    }
    options[key] = argv[i + 1];
  }

  const seed = Number(options.seed);
  const months = Number(options.months);
  if (!Number.isInteger(seed)) return invalid(io, "--seed");
  if (!Number.isInteger(months) || months < 12) return invalid(io, "--months (mínimo 12)");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(options["anchor-date"])) return invalid(io, "--anchor-date");
  const formats = new Set(options.format.split(","));

  const data = generateDataset({ seed, months, anchorDate: options["anchor-date"] });
  mkdirSync(options.out, { recursive: true });
  if (formats.has("json")) {
    writeFileSync(path.join(options.out, "dataset.json"), `${JSON.stringify(data, null, 2)}\n`);
  }
  for (const account of data.accounts) {
    if (formats.has("csv"))
      writeFileSync(path.join(options.out, `extrato-${account.id}.csv`), toCsv(data, account.id));
    if (formats.has("ofx"))
      writeFileSync(path.join(options.out, `extrato-${account.id}.ofx`), toOfx(data, account.id));
  }

  io.log(
    `Dados sintéticos (seed ${seed}): ${data.accounts.length} contas, ${data.transactions.length} transações, ` +
      `${months} meses até ${options["anchor-date"]} → ${options.out}`,
  );
  return 0;
}

function invalid(io: Io, name: string): number {
  io.error(`Argumento inválido: ${name}`);
  return 1;
}
