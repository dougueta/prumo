// T026 · research R-01 — configuração e instruções do revisor Gemini (FR-014, FR-015, FR-016, FR-020).
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { parseVerdict } from "../../../src/review/parse-verdict";

const root = path.resolve(__dirname, "../../..");
const read = (p: string) => readFileSync(path.join(root, p), "utf8").replace(/\r\n/g, "\n");

describe(".gemini/config.yaml", () => {
  const cfg = () => parse(read(".gemini/config.yaml"));

  it("revisor sem memória acumulada e sem 'diversão'", () => {
    expect(cfg().have_fun).toBe(false);
    expect(cfg().memory_config).toEqual({ disabled: true });
  });

  it("ignore_patterns = R-01 (o espelho dos workflows NÃO é ignorado)", () => {
    const ignored: string[] = cfg().ignore_patterns;
    expect(ignored).toEqual(["tests/fixtures/synthetic/**", "package-lock.json"]);
    expect(ignored.some((p) => p.startsWith("tests/unit/review"))).toBe(false);
  });

  it("todas as severidades, sem limite de comentários, revisão ao abrir e sem rascunhos", () => {
    expect(cfg().code_review).toMatchObject({
      comment_severity_threshold: "LOW",
      max_review_comments: -1,
      pull_request_opened: { code_review: true, summary: true, include_drafts: false, help: false },
    });
    expect(cfg().code_review.disable).not.toBe(true);
  });
});

describe(".gemini/styleguide.md", () => {
  const guide = () => read(".gemini/styleguide.md");

  it("traz o modelo do bloco de veredito exatamente como no contrato (e o parser o aceita)", () => {
    const block = /```markdown\n(<!-- prumo:veredito v1 -->[\s\S]*?)```/.exec(guide())?.[1];
    expect(block).toBeDefined();
    expect(block).toContain("## Veredito: APROVADO | MUDANÇAS NECESSÁRIAS");
    expect(block).toContain("| # | Severidade | Arquivo:linha | Princípio | Problema | Sugestão |");
    expect(block).toContain("### Achados anteriores");
    expect(block).toContain("| FR | Implementado em | Testado em | OK? |");
    const filled = block!.replace("APROVADO | MUDANÇAS NECESSÁRIAS", "APROVADO");
    expect(parseVerdict(filled, "gemini").status).toBe("ok");
  });

  it("exige terminar toda review com o bloco, em português", () => {
    expect(guide()).toMatch(/termine \*\*toda\*\* review com o bloco/i);
    expect(guide()).toMatch(/português/);
  });

  it("instrui a re-revisão: Achados anteriores para todos os # e respostas prumo:respostas", () => {
    expect(guide()).toContain("Achados anteriores");
    expect(guide()).toContain("<!-- prumo:respostas v1 -->");
    expect(guide()).toMatch(/todos os #/);
  });

  it("não usa justificativas do corpo do PR antes de formar o veredito (v1.2.0)", () => {
    expect(guide()).toMatch(/corpo do PR/);
  });

  it("revisa o espelho dos workflows como se fossem os workflows", () => {
    expect(guide()).toContain("tests/unit/review/__snapshots__/workflows.md");
  });
});
