import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * FR-052 (R$ 0, licenças abertas) e R-04/R-05 (fontes e ícones servidos pelo próprio app).
 * Lê a licença de cada dependência direta instalada em node_modules.
 */
const ROOT = path.resolve(__dirname, "../..");
const pkg = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8")) as {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

const ALLOWED = /^(MIT|ISC|Apache-2\.0|BSD-[0-9]-Clause|0BSD|OFL-1\.1)$/;
// Só ferramenta de teste (não vai para o bundle do app): @axe-core/playwright é MPL-2.0,
// licença aberta e gratuita (copyleft fraco por arquivo, sem efeito sobre o código do app).
const ALLOWED_DEV_ONLY = /^MPL-2\.0$/;

function licenseOf(name: string): string {
  const manifest = JSON.parse(
    readFileSync(path.join(ROOT, "node_modules", name, "package.json"), "utf8"),
  ) as { license?: string | { type: string } };
  const license = manifest.license;
  return typeof license === "string" ? license : (license?.type ?? "UNKNOWN");
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

describe("licenças e auto-hospedagem (FR-052)", () => {
  it("toda dependência de runtime tem licença aberta permitida", () => {
    const bad = Object.keys(pkg.dependencies)
      .map((name) => [name, licenseOf(name)] as const)
      .filter(([, license]) => !ALLOWED.test(license));
    expect(bad).toEqual([]);
  });

  it("toda dependência de desenvolvimento tem licença aberta permitida", () => {
    const bad = Object.keys(pkg.devDependencies)
      .map((name) => [name, licenseOf(name)] as const)
      .filter(([, license]) => !ALLOWED.test(license) && !ALLOWED_DEV_ONLY.test(license));
    expect(bad).toEqual([]);
  });

  it("a fonte Inter é auto-hospedada com a licença OFL", () => {
    const fonts = path.join(ROOT, "src/app/fonts");
    expect(existsSync(path.join(fonts, "OFL.txt"))).toBe(true);
    const woff2 = existsSync(fonts) ? readdirSync(fonts).filter((f) => f.endsWith(".woff2")) : [];
    expect(woff2.length).toBeGreaterThanOrEqual(1);
  });

  it("nenhum código do app referencia fontes ou ícones de CDN externa", () => {
    const offenders = walk(path.join(ROOT, "src"))
      .filter((file) => /\.(ts|tsx|css|mjs|js)$/.test(file))
      .filter((file) =>
        /fonts\.googleapis|fonts\.gstatic|cdnjs|unpkg\.com|jsdelivr|use\.fontawesome/.test(
          readFileSync(file, "utf8"),
        ),
      );
    expect(offenders).toEqual([]);
  });
});
