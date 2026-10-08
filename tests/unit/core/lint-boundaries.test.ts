import path from "node:path";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

// 004 · T065 — regras de fronteira do modelo core (plan §Bibliotecas, Constitution VII).
const root = path.resolve(__dirname, "../../..");

async function lint(file: string) {
  const eslint = new ESLint({ cwd: root, ignore: false });
  const [result] = await eslint.lintFiles([path.join(root, "tests/fixtures/lint", file)]);
  return result.messages.map((m) => m.ruleId);
}

describe("fronteiras do modelo core (lint)", () => {
  it("proíbe importar a implementação Supabase/memória fora de src/data/core", async () => {
    expect(await lint("forbidden-import.ts")).toContain("no-restricted-imports");
  }, 60_000);

  it("proíbe .from(<tabela core>).delete()", async () => {
    expect(await lint("forbidden-delete.ts")).toContain("no-restricted-syntax");
  }, 60_000);
});
