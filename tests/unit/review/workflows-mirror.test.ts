// T072 · plan §Governança C5 — espelho revisável dos workflows (FR-014, FR-016).
// O Gemini não revisa .github/workflows/**; ele revisa este espelho. Mudou um workflow?
// Rode `npm run review:mirror` e faça commit do espelho junto.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MIRROR_PATH } from "../../../src/review/catalog";
import { parseWorkflowMirror, renderWorkflowMirror } from "../../../src/review/mirror";

const root = path.resolve(__dirname, "../../..");
const lf = (s: string) => s.replace(/\r\n/g, "\n");
const workflows = () =>
  readdirSync(path.join(root, ".github/workflows"))
    .filter((f) => /\.ya?ml$/.test(f))
    .sort()
    .map((f) => ({
      path: `.github/workflows/${f}`,
      content: lf(readFileSync(path.join(root, ".github/workflows", f), "utf8")),
    }));

describe("renderWorkflowMirror / parseWorkflowMirror", () => {
  it("ida e volta preserva o conteúdo exato, inclusive crases", () => {
    const entries = [
      { path: ".github/workflows/a.yml", content: "name: A\n# ```\non: push\n" },
      { path: ".github/workflows/b.yml", content: "name: B\n" },
    ];
    expect(parseWorkflowMirror(renderWorkflowMirror(entries))).toEqual(entries);
  });
});

describe(`espelho ${MIRROR_PATH}`, () => {
  const mirror = () => parseWorkflowMirror(lf(readFileSync(path.join(root, MIRROR_PATH), "utf8")));

  it("contém o conteúdo exato de cada .github/workflows/*.yml (rode npm run review:mirror)", () => {
    const blocks = new Map(mirror().map((b) => [b.path, b.content]));
    for (const wf of workflows()) {
      expect(blocks.get(wf.path), `espelho desatualizado: ${wf.path}`).toBe(wf.content);
    }
  });

  it("não tem bloco de arquivo inexistente", () => {
    const existing = workflows().map((w) => w.path);
    for (const b of mirror()) expect(existing).toContain(b.path);
  });

  it("inclui os workflows da 001 (ci.yml e keepalive.yml)", () => {
    const paths = mirror().map((b) => b.path);
    expect(paths).toContain(".github/workflows/ci.yml");
    expect(paths).toContain(".github/workflows/keepalive.yml");
  });
});
