// 004 · R-12 — gera/verifica a migração de seed (category_templates + catálogo de instituições).
// Uso: `npx tsx scripts/generate-category-seed.ts` (reescreve) · `--check` (falha se divergir).
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildCatalogSeedSql } from "../src/domain/core/default-categories";

export { buildCatalogSeedSql };

type Io = { log: (message: string) => void; error: (message: string) => void };
const SUFFIX = "_core_seed_catalog.sql";

/** Devolve o código de saída: 0 ok, 1 divergente/ausente, 2 uso inválido. */
export function runSeedCli(argv: string[], io: Io): number {
  const check = argv.includes("--check");
  const dirIndex = argv.indexOf("--dir");
  const dir = dirIndex >= 0 ? argv[dirIndex + 1] : "supabase/migrations";
  if (!dir || !existsSync(dir)) {
    io.error(`Diretório de migrações inexistente: ${dir}`);
    return 2;
  }
  const files = readdirSync(dir).filter((file) => file.endsWith(SUFFIX));
  if (files.length !== 1) {
    io.error(
      `Esperada exatamente 1 migração *${SUFFIX} em ${dir} (crie com \`supabase migration new core_seed_catalog\`).`,
    );
    return 1;
  }
  const target = path.join(dir, files[0]);
  const expected = buildCatalogSeedSql();
  const current = readFileSync(target, "utf-8").replaceAll("\r\n", "\n");
  if (check) {
    if (current === expected) return 0;
    io.error(
      `${target} diverge da taxonomia em TS: rode \`npx tsx scripts/generate-category-seed.ts\`.`,
    );
    return 1;
  }
  writeFileSync(target, expected);
  io.log(`Seed gerado em ${target}`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exit(runSeedCli(process.argv.slice(2), console));
}
