import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * FR-004 — nenhuma cor literal fora dos fundamentos. Cores só em src/styles/tokens.css, no
 * espelho src/styles/tokens.ts (metadados que não leem CSS) e no logotipo (src/components/brand/).
 */
const ROOT = path.resolve(__dirname, "../..");
const SRC = path.join(ROOT, "src");
const EXEMPT = [
  path.join(SRC, "styles", "tokens.css"),
  path.join(SRC, "styles", "tokens.ts"),
  path.join(SRC, "components", "brand") + path.sep,
];
const COLOR_LITERAL = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\boklch\(/;

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

describe("guarda de tokens (FR-004)", () => {
  it("não há literal de cor fora de tokens.css/tokens.ts/brand", () => {
    const offenders = walk(SRC)
      .filter((file) => /\.(ts|tsx|css)$/.test(file))
      .filter((file) => !EXEMPT.some((exempt) => file === exempt || file.startsWith(exempt)))
      .flatMap((file) =>
        readFileSync(file, "utf8")
          .split("\n")
          .map((line, i) => ({ line, i }))
          .filter(({ line }) => COLOR_LITERAL.test(line))
          .map(({ line, i }) => `${path.relative(ROOT, file)}:${i + 1}: ${line.trim()}`),
      );
    expect(offenders).toEqual([]);
  });
});
