// T066 · data-model §7 + contracts/github-api.openapi.yaml (Ruleset) — ruleset "main protegida"
// (FR-001, FR-002, FR-003, FR-005).
import { describe, expect, it, vi } from "vitest";
import { runRuleset } from "../../../scripts/review/ruleset";
import { buildRuleset } from "../../../src/review/ruleset";
import { R, createFakeFetch, type Route } from "./fixtures/fake-fetch";
import { CI_JOB_NAMES, apiErrors } from "./fixtures";

const ciYaml = [
  "jobs:",
  ...CI_JOB_NAMES.flatMap((n, i) => [`  j${i}:`, `    name: ${n}`]),
  "  deploy-db:",
  "    name: Migrações de produção",
  "    if: github.event_name == 'push'",
].join("\n");

describe("buildRuleset", () => {
  const r = buildRuleset(CI_JOB_NAMES);

  it("cabeçalho do schema: nome, alvo, ativo, sem bypass, só a main", () => {
    expect(r).toMatchObject({
      name: "main protegida",
      target: "branch",
      enforcement: "active",
      bypass_actors: [],
      conditions: { ref_name: { include: ["refs/heads/main"], exclude: [] } },
    });
  });

  it("regras: deleção, force-push, histórico linear, PR só squash, checks estritos", () => {
    expect(r.rules.map((x) => x.type)).toEqual([
      "deletion",
      "non_fast_forward",
      "required_linear_history",
      "pull_request",
      "required_status_checks",
    ]);
    expect(r.rules[3].parameters).toMatchObject({
      required_approving_review_count: 0,
      allowed_merge_methods: ["squash"],
    });
  });

  it("checks = jobs de PR do CI + Revisão independente, todos do app GitHub Actions", () => {
    const params = r.rules[4].parameters as {
      strict_required_status_checks_policy: boolean;
      required_status_checks: { context: string; integration_id: number }[];
    };
    expect(params.strict_required_status_checks_policy).toBe(true);
    expect(params.required_status_checks).toEqual(
      [...CI_JOB_NAMES, "Revisão independente"].map((context) => ({
        context,
        integration_id: 15368,
      })),
    );
  });
});

async function run(routes: Record<string, Route>, argv: string[] = []) {
  const fake = createFakeFetch({
    [`GET ${R}/contents/.github/workflows/ci.yml`]: {
      body: { content: Buffer.from(ciYaml).toString("base64") },
    },
    ...routes,
  });
  const out: string[] = [];
  const code = await runRuleset({
    argv,
    fetch: fake.fetch,
    exec: vi.fn(async () => ({ code: 0, stdout: "tok\n" })),
    sleep: async () => {},
    log: (m) => out.push(m),
  });
  return {
    code,
    out: out.join("\n"),
    writes: fake.calls.filter((c) => c.method !== "GET"),
    calls: fake.calls,
  };
}

describe("runRuleset (npm run gh:ruleset)", () => {
  it("cria (POST) quando não existe 'main protegida'", async () => {
    const { code, writes, calls } = await run({
      [`GET ${R}/rulesets`]: { body: [{ id: 1, name: "outro" }] },
      [`POST ${R}/rulesets`]: { status: 201, body: { id: 9 } },
    });
    expect(code).toBe(0);
    expect(writes).toHaveLength(1);
    expect(writes[0].method).toBe("POST");
    expect(writes[0].body).toEqual(buildRuleset(CI_JOB_NAMES));
    expect(calls[0].query).toBe("?ref=main");
  });

  it("atualiza (PUT) quando já existe, pelo nome", async () => {
    const { code, writes } = await run({
      [`GET ${R}/rulesets`]: { body: [{ id: 7, name: "main protegida" }] },
      [`PUT ${R}/rulesets/7`]: { body: { id: 7 } },
    });
    expect(code).toBe(0);
    expect(writes.map((w) => `${w.method} ${w.path}`)).toEqual([`PUT ${R}/rulesets/7`]);
  });

  it("--dry-run mostra o JSON e não escreve", async () => {
    const { code, writes, out } = await run({ [`GET ${R}/rulesets`]: { body: [] } }, ["--dry-run"]);
    expect(code).toBe(0);
    expect(writes).toEqual([]);
    expect(out).toContain('"name": "main protegida"');
  });

  it("422 ⇒ exit 1 com a mensagem", async () => {
    const { code, out } = await run({
      [`GET ${R}/rulesets`]: { body: [] },
      [`POST ${R}/rulesets`]: apiErrors.unprocessable,
    });
    expect(code).toBe(1);
    expect(out).toContain("Validation Failed");
  });
});
