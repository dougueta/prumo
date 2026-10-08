// T063 · contracts/review-gate.md §main-guard — scripts/review/main-guard.ts (modo push)
// com fetch falso (FR-004, FR-024).
import { describe, expect, it } from "vitest";
import { runMainGuard } from "../../../scripts/review/main-guard";
import { R, createFakeFetch, type Route } from "./fixtures/fake-fetch";
import {
  BASE,
  CI_JOB_NAMES,
  HEAD,
  apiCheckRuns,
  apiCompare,
  apiFiles,
  apiPull,
  geminiReview,
  sha,
  trailers,
} from "./fixtures";

const MERGE = sha("d");
const P = `${R}/pulls/42`;
const ciYaml = [
  "jobs:",
  ...CI_JOB_NAMES.flatMap((n, i) => [`  j${i}:`, `    name: ${n}`]),
  "  main-guard:",
  "    name: Guarda da main",
  "    if: github.event_name == 'push'",
].join("\n");
const merged = (over = {}) =>
  apiPull({ merged_at: "2026-10-06T15:00:00Z", merge_commit_sha: MERGE, state: "closed", ...over });

function routes(over: Record<string, Route> = {}): Record<string, Route> {
  return {
    [`GET ${R}/commits/${MERGE}`]: {
      body: { sha: MERGE, parents: [{ sha: BASE }], commit: { message: "x" } },
    },
    [`GET ${R}/commits/${MERGE}/pulls`]: { body: [merged()] },
    [`GET ${P}`]: { body: merged() },
    [`GET ${P}/commits`]: { body: [{ sha: HEAD, commit: { message: trailers.claude } }] },
    [`GET ${P}/files`]: { body: apiFiles },
    [`GET ${P}/reviews`]: { body: [geminiReview({ id: 1, at: "2026-10-06T10:00:00Z" })] },
    [`GET ${P}/comments`]: { body: [] },
    [`GET ${R}/issues/42/comments`]: { body: [] },
    [`GET ${R}/contents/specs/999-exemplo/spec.md`]: { body: { content: "" } },
    [`GET ${R}/compare/main...${HEAD}`]: { body: apiCompare() },
    [`GET ${R}/commits/${HEAD}/check-runs`]: {
      body: apiCheckRuns(CI_JOB_NAMES.map((name) => ({ name, conclusion: "success" }))),
    },
    [`GET ${R}/contents/.github/workflows/ci.yml`]: {
      body: { content: Buffer.from(ciYaml).toString("base64") },
    },
    [`GET ${R}/issues`]: { body: [] },
    [`POST ${R}/issues`]: { status: 201, body: { number: 900 } },
    ...over,
  };
}

async function run(r: Record<string, Route>) {
  const fake = createFakeFetch(r);
  const code = await runMainGuard({
    mode: "push",
    env: { GITHUB_TOKEN: "tok", COMMIT_SHA: MERGE },
    fetch: fake.fetch,
    sleep: async () => {},
    log: () => {},
    now: () => new Date("2026-10-06T15:05:00Z"),
  });
  return { code, calls: fake.calls, writes: fake.calls.filter((c) => c.method !== "GET") };
}

describe("runMainGuard (push)", () => {
  it("tudo certo ⇒ exit 0 e nada criado", async () => {
    const { code, writes, calls } = await run(routes());
    expect(code).toBe(0);
    expect(writes).toEqual([]);
    const ci = calls.find((c) => c.path.endsWith("/contents/.github/workflows/ci.yml"));
    expect(ci?.query).toBe(`?ref=${MERGE}`);
  });

  it("commit sem PR ⇒ issue violacao-main atribuída a dougueta e exit 1", async () => {
    const { code, writes } = await run(
      routes({ [`GET ${R}/commits/${MERGE}/pulls`]: { body: [] } }),
    );
    expect(code).toBe(1);
    expect(writes).toHaveLength(1);
    expect(writes[0].path).toBe(`${R}/issues`);
    expect(writes[0].body).toMatchObject({
      title: `Violação da proteção da main: ${MERGE.slice(0, 7)}`,
      labels: ["violacao-main"],
      assignees: ["dougueta"],
    });
    expect((writes[0].body as { body: string }).body).toContain("commit sem PR integrado");
  });

  it("status forjado (sem veredito) ⇒ violação", async () => {
    const { code, writes } = await run(routes({ [`GET ${P}/reviews`]: { body: [] } }));
    expect(code).toBe(1);
    expect((writes[0].body as { body: string }).body).toContain("aguardando veredito de Gemini");
  });

  it("idempotente: não cria issue se já existe aberta com o mesmo título", async () => {
    const { code, writes, calls } = await run(
      routes({
        [`GET ${R}/commits/${MERGE}/pulls`]: { body: [] },
        [`GET ${R}/issues`]: {
          body: [{ number: 5, title: `Violação da proteção da main: ${MERGE.slice(0, 7)}` }],
        },
      }),
    );
    expect(code).toBe(1);
    expect(writes).toEqual([]);
    const list = calls.find((c) => c.path === `${R}/issues`);
    expect(list?.query).toContain("labels=violacao-main");
    expect(list?.query).toContain("state=open");
  });

  it("PR emergencia ⇒ issue 'Revisão pós-merge pendente: #42' (não é violação)", async () => {
    const pr = merged({
      labels: [{ name: "autor:claude" }, { name: "iniciativa:3" }, { name: "emergencia" }],
      body: "Motivo da emergência: produção fora do ar ao abrir o extrato",
    });
    const { code, writes } = await run(
      routes({
        [`GET ${P}`]: { body: pr },
        [`GET ${R}/commits/${MERGE}/pulls`]: { body: [pr] },
        [`GET ${P}/reviews`]: { body: [] },
      }),
    );
    expect(code).toBe(0);
    expect(writes).toHaveLength(1);
    expect(writes[0].body).toMatchObject({
      title: "Revisão pós-merge pendente: #42",
      labels: ["emergencia"],
      assignees: ["dougueta"],
    });
  });
});
