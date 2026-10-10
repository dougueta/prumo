// T059 · data-model §1.1 — verificações obrigatórias derivadas do ci.yml (FR-002).
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { requiredChecksFromCi } from "../../../src/review/ci-checks";
import { CI_JOB_NAMES } from "./fixtures";

const root = path.resolve(__dirname, "../../..");
const load = (p: string) => parse(readFileSync(path.resolve(root, p), "utf8"));

describe("requiredChecksFromCi", () => {
  it("jobs sem if entram; jobs com if (main-guard, deploy-db) ficam fora", () => {
    expect(
      requiredChecksFromCi(load("tests/unit/review/fixtures/workflows/ci.example.yml")),
    ).toEqual(["Qualidade", "Testes unitários"]);
  });

  it("job sem name ⇒ erro", () => {
    expect(() =>
      requiredChecksFromCi({ jobs: { lint: { "runs-on": "ubuntu-latest", steps: [] } } }),
    ).toThrow("job sem nome no CI: lint");
  });

  it("workflow sem jobs ⇒ erro", () => {
    expect(() => requiredChecksFromCi({ name: "CI" })).toThrow();
    expect(() => requiredChecksFromCi(null)).toThrow();
  });

  it("ci.yml real do repositório: contém os 4 jobs da 001 e nenhum job com if", () => {
    const ci = load(".github/workflows/ci.yml") as {
      jobs: Record<string, { name: string; if?: string }>;
    };
    const checks = requiredChecksFromCi(ci);
    for (const name of CI_JOB_NAMES) expect(checks).toContain(name);
    const withIf = Object.values(ci.jobs)
      .filter((j) => j.if !== undefined)
      .map((j) => j.name);
    expect(withIf.length).toBeGreaterThan(0);
    for (const name of withIf) expect(checks).not.toContain(name);
  });
});
