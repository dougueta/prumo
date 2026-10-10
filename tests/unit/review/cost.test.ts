// T071 · FR-025, SC-008 — a 002 custa R$ 0: nenhuma dependência nova, nenhuma ação ou API paga.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../../..");
const read = (p: string) => readFileSync(path.join(root, p), "utf8");
const pkg = JSON.parse(read("package.json"));
const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });

/** Dependências que já existiam antes da 002 (a 002 não acrescenta nenhuma). */
const BEFORE_002 = [
  "@supabase/supabase-js",
  "next",
  "react",
  "react-dom",
  "server-only",
  "zod",
  "@playwright/test",
  "@tailwindcss/postcss",
  "@testing-library/dom",
  "@testing-library/react",
  "@types/node",
  "@types/react",
  "@types/react-dom",
  "@vitejs/plugin-react",
  "ajv",
  "ajv-formats",
  "eslint",
  "eslint-config-next",
  "fast-xml-parser",
  "jsdom",
  "prettier",
  "tailwindcss",
  "tsx",
  "typescript",
  "vitest",
  "yaml",
];

const filesIn = (dir: string): string[] =>
  readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? filesIn(`${dir}/${e.name}`) : [`${dir}/${e.name}`],
  );

describe("custo zero (FR-025)", () => {
  it("as dependências de antes da 002 continuam lá (a lista registrada é a base)", () => {
    for (const d of BEFORE_002) expect(deps).toContain(d);
  });

  it("nenhuma dependência paga ou proibida pelo plano", () => {
    for (const d of deps) {
      expect(d).not.toMatch(/^@octokit\//);
      expect(d).not.toBe("jsonwebtoken");
      expect(d).not.toMatch(/^@anthropic-ai\//);
    }
  });

  it("o código da 002 só importa node:*, yaml e módulos do próprio repositório", () => {
    const code = [...filesIn("src/review"), ...filesIn("scripts/review")].filter((f) =>
      f.endsWith(".ts"),
    );
    expect(code.length).toBeGreaterThan(10);
    for (const f of code) {
      for (const m of read(f).matchAll(/^import[^"']*["']([^"']+)["']/gm)) {
        const spec = m[1];
        const ok = spec.startsWith("node:") || spec === "yaml" || spec.startsWith(".");
        expect(ok, `${f} importa ${spec}`).toBe(true);
      }
    }
  });

  it("nenhum workflow usa claude-code-action nem segredos de API paga", () => {
    for (const f of readdirSync(path.join(root, ".github/workflows"))) {
      const text = read(`.github/workflows/${f}`);
      expect(text).not.toContain("anthropics/claude-code-action");
      expect(text).not.toMatch(/ANTHROPIC_API_KEY|GEMINI_API_KEY/);
    }
  });
});
