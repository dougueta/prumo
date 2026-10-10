// T064 · contracts/review-cli.md §pr:merge — scripts/review/merge.ts com exec/TTY/prompt falsos
// (FR-003, FR-004).
import { describe, expect, it, vi } from "vitest";
import { runMerge, type Exec } from "../../../scripts/review/merge";
import { R, createFakeFetch, type Route } from "./fixtures/fake-fetch";
import {
  CI_JOB_NAMES,
  HEAD,
  apiCheckRuns,
  apiCompare,
  apiFiles,
  apiPull,
  geminiReview,
  trailers,
} from "./fixtures";

const P = `${R}/pulls/42`;
const ciYaml = ["jobs:", ...CI_JOB_NAMES.flatMap((n, i) => [`  j${i}:`, `    name: ${n}`])].join(
  "\n",
);

function routes(over: Record<string, Route> = {}): Record<string, Route> {
  return {
    [`GET ${P}`]: { body: apiPull() },
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
    ...over,
  };
}

async function run(
  r: Record<string, Route>,
  opts: { tty?: boolean; answers?: string[]; argv?: string[] } = {},
) {
  const fake = createFakeFetch(r);
  const exec = vi.fn<Exec>(async (cmd, args) =>
    cmd === "gh" && args[0] === "auth"
      ? { code: 0, stdout: "tok-do-doug\n" }
      : { code: 0, stdout: "" },
  );
  const answers = [...(opts.answers ?? [])];
  const prompt = vi.fn(async () => answers.shift() ?? "");
  const out: string[] = [];
  const code = await runMerge({
    argv: opts.argv ?? ["42"],
    isTty: opts.tty ?? true,
    fetch: fake.fetch,
    exec,
    prompt,
    sleep: async () => {},
    log: (m) => out.push(m),
  });
  const merges = exec.mock.calls.filter(([cmd, args]) => cmd === "gh" && args[0] === "pr");
  return { code, merges, prompt, out: out.join("\n"), calls: fake.calls };
}

describe("runMerge", () => {
  it("pronto ⇒ gh pr merge 42 --squash --delete-branch (com o head conferido) e exit 0", async () => {
    const { code, merges } = await run(routes());
    expect(code).toBe(0);
    expect(merges).toEqual([
      ["gh", ["pr", "merge", "42", "--squash", "--delete-branch", "--match-head-commit", HEAD]],
    ]);
  });

  it("fora de TTY ⇒ exit 8, sem chamar API nem merge", async () => {
    const { code, merges, calls } = await run(routes(), { tty: false });
    expect(code).toBe(8);
    expect(merges).toEqual([]);
    expect(calls).toEqual([]);
  });

  it("número inválido ⇒ exit 1", async () => {
    expect((await run(routes(), { argv: ["abc"] })).code).toBe(1);
  });

  it("check vermelho ⇒ exit 6 sem merge", async () => {
    const { code, merges, out } = await run(
      routes({
        [`GET ${R}/commits/${HEAD}/check-runs`]: {
          body: apiCheckRuns(
            CI_JOB_NAMES.map((name, i) => ({ name, conclusion: i ? "success" : "failure" })),
          ),
        },
      }),
    );
    expect(code).toBe(6);
    expect(merges).toEqual([]);
    expect(out).toContain(CI_JOB_NAMES[0]);
  });

  it("status forjado: sem veredito ⇒ exit 6 'aguardando veredito de Gemini'", async () => {
    const { code, merges, out } = await run(routes({ [`GET ${P}/reviews`]: { body: [] } }));
    expect(code).toBe(6);
    expect(merges).toEqual([]);
    expect(out).toContain("aguardando veredito de Gemini");
  });

  it("branch atrás da main ⇒ exit 7 sem merge", async () => {
    const { code, merges } = await run(
      routes({ [`GET ${R}/compare/main...${HEAD}`]: { body: apiCompare({ behind_by: 1 }) } }),
    );
    expect(code).toBe(7);
    expect(merges).toEqual([]);
  });

  it("PR que toca o portão pede 'revisei'; resposta errada ⇒ exit 9 sem merge", async () => {
    const files = [
      ...apiFiles,
      { filename: "src/review/catalog.ts", status: "modified", patch: "@@\n+x" },
    ];
    const r = routes({ [`GET ${P}/files`]: { body: files } });
    const no = await run(r, { answers: ["sim"] });
    expect(no.code).toBe(9);
    expect(no.merges).toEqual([]);
    expect(no.prompt).toHaveBeenCalledTimes(1);
    const yes = await run(r, { answers: ["revisei"] });
    expect(yes.code).toBe(0);
    expect(yes.merges).toHaveLength(1);
  });

  it("emergência pede 'emergencia'; sem a confirmação ⇒ exit 9", async () => {
    const pr = apiPull({
      labels: [{ name: "autor:claude" }, { name: "iniciativa:0" }, { name: "emergencia" }],
      body: "Motivo da emergência: produção fora do ar ao abrir o extrato",
    });
    const r = routes({ [`GET ${P}`]: { body: pr }, [`GET ${P}/reviews`]: { body: [] } });
    expect((await run(r, { answers: [""] })).code).toBe(9);
    const ok = await run(r, { answers: ["emergencia"] });
    expect(ok.code).toBe(0);
    expect(ok.merges).toHaveLength(1);
  });

  it("autor:doug sem nenhum trailer de agente ⇒ aviso (risco residual do ADR 0007)", async () => {
    const pr = apiPull({ labels: [{ name: "autor:doug" }, { name: "iniciativa:0" }] });
    const r = routes({
      [`GET ${P}`]: { body: pr },
      [`GET ${P}/commits`]: { body: [{ sha: HEAD, commit: { message: trailers.none } }] },
    });
    const { code, out } = await run(r);
    expect(code).toBe(0);
    expect(out).toContain("autor:doug sem nenhum trailer de agente");
    const claude = await run(routes());
    expect(claude.out).not.toContain("sem nenhum trailer");
  });

  it("falha do gh pr merge ⇒ exit 1", async () => {
    const fake = createFakeFetch(routes());
    const exec = vi.fn<Exec>(async (_cmd, args) =>
      args[0] === "auth" ? { code: 0, stdout: "tok" } : { code: 1, stdout: "" },
    );
    const code = await runMerge({
      argv: ["42"],
      isTty: true,
      fetch: fake.fetch,
      exec,
      prompt: async () => "",
      sleep: async () => {},
      log: () => {},
    });
    expect(code).toBe(1);
  });
});
