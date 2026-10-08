import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * FR-050/FR-051 — o design system não acessa banco nem cria tabelas: funciona inteiro em
 * modo demonstração (Constitution VII, ADR 0006).
 */
const ROOT = path.resolve(__dirname, "../..");
const FORBIDDEN_IMPORT =
  /from\s+["'](@supabase\/[^"']*|@\/lib\/supabase(\/[^"']*)?|@\/data(\/[^"']*)?)["']/;

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const SCOPED = [
  ...walk(path.join(ROOT, "src/components")),
  ...walk(path.join(ROOT, "src/catalog")),
  ...walk(path.join(ROOT, "src/app/(app)")),
  ...["format", "preferences", "navigation", "catalog-access"].map((name) =>
    path.join(ROOT, `src/lib/${name}.ts`),
  ),
].filter((file) => /\.(ts|tsx)$/.test(file) && existsSync(file));

describe("guarda de escopo da 003 (FR-050, FR-051)", () => {
  it("componentes, catálogo e páginas da 003 não importam acesso a dados", () => {
    const offenders = SCOPED.filter((file) => FORBIDDEN_IMPORT.test(readFileSync(file, "utf8")));
    expect(offenders.map((file) => path.relative(ROOT, file))).toEqual([]);
  });

  it("a 003 não adiciona nada em supabase/ (sem migrações nem tabelas)", () => {
    let base: string;
    try {
      base = execFileSync("git", ["merge-base", "HEAD", "origin/main"], { cwd: ROOT })
        .toString()
        .trim();
    } catch {
      return; // clone raso sem origin/main: a checagem do diff fica para o CI completo.
    }
    const changed = execFileSync("git", ["diff", "--name-only", base, "--", "supabase/"], {
      cwd: ROOT,
    })
      .toString()
      .trim();
    expect(changed).toBe("");
  });
});
