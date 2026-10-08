// T069 · contracts/review-cli.md §review:bundle — scripts/review/bundle.ts com exec falso
// (FR-017, FR-018). Só lê dados com gh/git; nunca executa arquivo do PR.
import { describe, expect, it, vi } from "vitest";
import { runBundle } from "../../../scripts/review/bundle";
import type { Exec } from "../../../scripts/review/github";
import { HEAD, issueComment, responsesBody, users, verdictBody } from "./fixtures";

const BASE = "c".repeat(40);
const BRANCH = "010-importacao-pdf-fatura";

function prJson(over: Record<string, unknown> = {}) {
  return JSON.stringify({
    number: 7,
    state: "OPEN",
    isDraft: false,
    labels: [{ name: "autor:gemini" }, { name: "iniciativa:2" }],
    author: { login: "dougueta" },
    headRefName: BRANCH,
    headRefOid: HEAD,
    baseRefOid: BASE,
    isCrossRepository: false,
    headRepository: { name: "prumo" },
    headRepositoryOwner: { login: "dougueta" },
    ...over,
  });
}

const headTree: Record<string, string> = {
  [`specs/${BRANCH}/spec.md`]: "# Spec 010",
  [`specs/${BRANCH}/tasks.md`]: "# Tasks",
  [`specs/${BRANCH}/contracts/api.yaml`]: "openapi: 3.1.0",
};
const mainTree: Record<string, string> = {
  ".specify/memory/constitution.md": "# Constitution",
  "docs/adr/0001-a.md": "# ADR 1",
  "docs/review-checklist.md": "# Checklist",
};

function makeExec(over: { pr?: string; comments?: string[] } = {}) {
  return vi.fn<Exec>(async (cmd, args) => {
    const a = args.join(" ");
    if (cmd === "gh" && a.startsWith("pr view 7")) return { code: 0, stdout: over.pr ?? prJson() };
    if (cmd === "gh" && a.startsWith("api repos/dougueta/prumo/issues/7/comments")) {
      return { code: 0, stdout: (over.comments ?? []).join("\n") };
    }
    if (cmd === "git" && args[0] === "fetch") return { code: 0, stdout: "" };
    if (cmd === "git" && a === `diff ${BASE}...${HEAD}`)
      return { code: 0, stdout: "diff --git a/x b/x\n+y" };
    if (cmd === "git" && args[0] === "ls-tree" && args.includes(HEAD)) {
      return { code: 0, stdout: Object.keys(headTree).join("\n") };
    }
    if (cmd === "git" && args[0] === "ls-tree" && args.includes("origin/main")) {
      return { code: 0, stdout: "docs/adr/0001-a.md\ndocs/adr/README.md" };
    }
    if (cmd === "git" && args[0] === "show") {
      const [ref, ...rest] = args[1].split(":");
      const p = rest.join(":");
      const tree = ref === HEAD ? headTree : ref === "origin/main" ? mainTree : {};
      return p in tree ? { code: 0, stdout: tree[p] } : { code: 128, stdout: "" };
    }
    return { code: 99, stdout: `comando inesperado: ${cmd} ${a}` };
  });
}

async function run(exec = makeExec(), argv = ["7"]) {
  const written = new Map<string, string>();
  const out: string[] = [];
  const code = await runBundle({
    argv,
    cwd: "/repo",
    exec,
    writeFile: (p, c) => void written.set(p.replace(/\\/g, "/").replace(/^[A-Za-z]:/, ""), c),
    mkdir: () => {},
    removeDir: () => {},
    now: () => new Date("2026-10-06T12:00:00Z"),
    log: (m) => out.push(m),
  });
  return { code, written, out: out.join("\n"), exec };
}

describe("runBundle (npm run review:bundle)", () => {
  it("monta .review/7/ com diff, spec do head, constitution/ADRs/checklist da main e manifest", async () => {
    const { code, written, out } = await run();
    expect(code).toBe(0);
    const root = "/repo/.review/7/";
    expect(written.get(`${root}diff.patch`)).toBe("diff --git a/x b/x\n+y");
    expect(written.get(`${root}spec/spec.md`)).toBe("# Spec 010");
    expect(written.get(`${root}spec/contracts/api.yaml`)).toBe("openapi: 3.1.0");
    expect(written.get(`${root}constitution.md`)).toBe("# Constitution");
    expect(written.get(`${root}adr/0001-a.md`)).toBe("# ADR 1");
    expect(written.get(`${root}review-checklist.md`)).toBe("# Checklist");
    expect(written.has(`${root}spec/plan.md`)).toBe(false);
    const manifest = JSON.parse(written.get(`${root}manifest.json`)!);
    expect(manifest).toMatchObject({ pr: 7, headSha: HEAD, baseSha: BASE, branch: BRANCH });
    const byPath = Object.fromEntries(
      manifest.files.map((f: { path: string; sha256: string }) => [f.path, f.sha256]),
    );
    expect(byPath["spec/plan.md"]).toBe("ausente");
    expect(byPath["adr/README.md"]).toBe("ausente");
    expect(byPath["diff.patch"]).toMatch(/^[0-9a-f]{64}$/);
    expect(Object.keys(byPath).sort()).toEqual(
      [...written.keys()]
        .filter((k) => !k.endsWith("manifest.json"))
        .map((k) => k.slice(root.length))
        .concat(["spec/plan.md", "spec/data-model.md", "adr/README.md"])
        .sort(),
    );
    expect(out).toContain(".review/7");
  });

  it("só chama gh/git com subcomandos de leitura (nunca executa arquivo do PR)", async () => {
    const { exec } = await run();
    for (const [cmd, args] of exec.mock.calls) {
      expect(["gh", "git"]).toContain(cmd);
      const sub = cmd === "gh" ? `${args[0]} ${args[1]}` : args[0];
      expect([
        "pr view",
        "api repos/dougueta/prumo/issues/7/comments",
        "fetch",
        "diff",
        "ls-tree",
        "show",
      ]).toContain(sub);
    }
    expect(exec.mock.calls.some(([, args]) => args.includes("pull/7/head"))).toBe(true);
  });

  it("re-revisão: grava anteriores/veredito.md e anteriores/respostas.md (só tabelas)", async () => {
    const v = issueComment({
      id: 10,
      at: "2026-10-06T10:00:00Z",
      user: users.revisor,
      body: verdictBody({
        outcome: "MUDANÇAS NECESSÁRIAS",
        findings: [[1, "ALTO"]],
        head: HEAD,
        inputs: ["diff.patch"],
      }),
    });
    const r = issueComment({
      id: 11,
      at: "2026-10-06T11:00:00Z",
      body: `livre\n${responsesBody([[1, "corrigido", "abcdef1"]])}`,
    });
    const { code, written } = await run(
      makeExec({ comments: [JSON.stringify(v), JSON.stringify(r)] }),
    );
    expect(code).toBe(0);
    expect(written.get("/repo/.review/7/anteriores/veredito.md")).toBe(v.body);
    const resp = written.get("/repo/.review/7/anteriores/respostas.md")!;
    expect(resp).toContain("| 1 | corrigido | abcdef1 |");
    expect(resp).not.toContain("livre");
  });

  it.each([
    [prJson({ labels: [{ name: "autor:claude" }] }), 3, "revisor e autor são o mesmo agente"],
    [prJson({ labels: [{ name: "autor:doug" }] }), 3, "este PR é revisado pelo Gemini"],
    [prJson({ labels: [] }), 3, "rótulo de autor ausente ou ambíguo"],
    [prJson({ author: { login: "terceiro" } }), 3, "PR de autor externo — não aceito"],
    [
      prJson({ isCrossRepository: true, headRepositoryOwner: { login: "terceiro" } }),
      3,
      "PR de autor externo — não aceito",
    ],
    [prJson({ state: "CLOSED" }), 1, "PR #7 não encontrado ou fechado"],
    [prJson({ isDraft: true }), 1, "PR em rascunho — aguarde ficar pronto"],
  ])("recusa %# com exit %i", async (pr, exit, message) => {
    const { code, written, out } = await run(makeExec({ pr }));
    expect(code).toBe(exit);
    expect(out).toContain(message);
    expect(written.size).toBe(0);
  });

  it("PR inexistente (gh falha) ⇒ exit 1", async () => {
    const exec = vi.fn<Exec>(async () => ({ code: 1, stdout: "" }));
    const { code, out } = await run(exec);
    expect(code).toBe(1);
    expect(out).toContain("PR #7 não encontrado ou fechado");
  });

  it("número inválido ⇒ exit 1", async () => {
    expect((await run(makeExec(), ["x"])).code).toBe(1);
  });
});
