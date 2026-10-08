// T067 · documentos de processo após a 002 (FR-023, FR-025, FR-026).
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../../..");
const read = (p: string) => readFileSync(path.join(root, p), "utf8");

const PROCESS_DOCS = ["docs/workflow.md", "AGENTS.md", "CLAUDE.md", "GEMINI.md"];

describe.each(PROCESS_DOCS)("%s", (file) => {
  const text = () => read(file);

  it("registra o fim da exceção de bootstrap com data", () => {
    expect(text()).toMatch(/exceção de bootstrap encerrada em \d{4}-\d{2}-\d{2}/);
  });

  it("exige os rótulos autor:* e iniciativa:N", () => {
    expect(text()).toContain("autor:");
    expect(text()).toContain("iniciativa:N");
  });

  it("merge só pelo Doug com npm run pr:merge", () => {
    expect(text()).toContain("npm run pr:merge");
  });

  it("espelho dos workflows e gh:ruleset", () => {
    expect(text()).toContain("atualize o espelho dos workflows");
    expect(text()).toContain("rode `npm run gh:ruleset` ao mudar jobs do CI");
  });
});

describe.each(["AGENTS.md", "GEMINI.md"])("%s — trailer do Gemini", (file) => {
  it("exige Co-Authored-By: Gemini <noreply@google.com>", () => {
    expect(read(file)).toContain("Co-Authored-By: Gemini <noreply@google.com>");
  });
});

describe("docs/gemini-handoff.md", () => {
  it("tem a seção Revisões pendentes com a busca de PRs autor:claude", () => {
    const text = read("docs/gemini-handoff.md");
    expect(text).toMatch(/^## Revisões pendentes/m);
    expect(text).toContain("label:autor:claude");
  });
});

describe("README.md", () => {
  it("tem a seção Revisão de PRs com custo R$ 0", () => {
    const text = read("README.md");
    const section = text.split(/^## /m).find((s) => s.startsWith("Revisão de PRs"));
    expect(section).toBeDefined();
    expect(section).toContain("R$ 0");
  });
});

describe("ADR 0007", () => {
  const file = "docs/adr/0007-protecao-main-repo-publico.md";

  it("existe e está no índice", () => {
    expect(existsSync(path.join(root, file))).toBe(true);
    expect(read("docs/adr/README.md")).toContain("0007-protecao-main-repo-publico.md");
  });

  it("tem a análise de ameaça do repositório público e os riscos residuais", () => {
    const text = read(file);
    expect(text).toMatch(/^## Análise de ameaça — repositório público/m);
    expect(text).toMatch(/^## Riscos residuais/m);
  });
});
