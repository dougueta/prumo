// T006 · contracts/veredito.md §1 — parseVerdict (FR-007, FR-010, FR-016, FR-020).
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { inlineSeverity, parseVerdict } from "../../../src/review/parse-verdict";
import { HEAD, verdictBody, warningsCommentBody } from "./fixtures";

const ok = (body: string, reviewer: "gemini" | "claude" = "gemini") => {
  const r = parseVerdict(body, reviewer);
  if (r.status !== "ok") throw new Error(`esperava ok, veio ${JSON.stringify(r)}`);
  return r.verdict;
};
const invalid = (body: string, reviewer: "gemini" | "claude" = "gemini") => {
  const r = parseVerdict(body, reviewer);
  expect(r.status).toBe("invalid");
  return r.status === "invalid" ? r.error : "";
};

describe("parseVerdict — marcador", () => {
  it("sem marcador não é veredito (ignorado silenciosamente)", () => {
    expect(parseVerdict("## Veredito: APROVADO\nLGTM", "gemini")).toEqual({ status: "absent" });
  });

  it("comentário de avisos do portão é ignorado", () => {
    expect(parseVerdict(warningsCommentBody, "gemini")).toEqual({ status: "absent" });
  });

  it("aceita texto livre antes do marcador (resumo do Gemini)", () => {
    const v = ok(verdictBody({ preamble: "## Code Review\n\nResumo." }));
    expect(v.outcome).toBe("APROVADO");
    expect(v.findings).toEqual([]);
    expect(v.coverage).toEqual([
      {
        fr: "FR-001",
        implementedIn: "src/exemplo.ts",
        testedIn: "tests/unit/exemplo.test.ts",
        ok: true,
      },
    ]);
  });

  it("Gemini: head= é opcional e ignorado", () => {
    expect(ok(verdictBody({ head: HEAD })).outcome).toBe("APROVADO");
  });
});

describe("parseVerdict — estrutura", () => {
  it("sem cabeçalho Veredito → fora do formato", () => {
    expect(invalid(verdictBody().replace("## Veredito: APROVADO", "## Resultado"))).toMatch(
      /cabeçalho/,
    );
  });

  it("cabeçalho com resultado desconhecido → fora do formato", () => {
    invalid(verdictBody().replace("APROVADO", "TALVEZ"));
  });

  it("sem tabela Achados → fora do formato", () => {
    const body = verdictBody().replace(/### Achados\n(\|.*\n)+/, "");
    expect(invalid(body)).toMatch(/Achados/);
  });

  it("sem tabela Cobertura → fora do formato", () => {
    expect(invalid(verdictBody({ coverage: false }))).toMatch(/Cobertura/);
  });

  it("MUDANÇAS NECESSÁRIAS com achados de todas as severidades", () => {
    const v = ok(
      verdictBody({
        outcome: "MUDANÇAS NECESSÁRIAS",
        findings: [
          [1, "CRÍTICO"],
          [2, "ALTO"],
          [3, "MÉDIO"],
          [4, "BAIXO"],
        ],
      }),
    );
    expect(v.outcome).toBe("MUDANÇAS NECESSÁRIAS");
    expect(v.findings.map((f) => [f.n, f.severity])).toEqual([
      [1, "CRÍTICO"],
      [2, "ALTO"],
      [3, "MÉDIO"],
      [4, "BAIXO"],
    ]);
    expect(v.findings[0]).toMatchObject({
      location: "src/exemplo.ts:1",
      principle: "III",
      problem: "problema 1",
      suggestion: "sugestão 1",
    });
  });

  it("aceita severidade sem acento (CRITICO, MEDIO) e normaliza", () => {
    const v = ok(
      verdictBody({
        outcome: "MUDANÇAS NECESSÁRIAS",
        findings: [
          [1, "CRITICO"],
          [2, "MEDIO"],
        ],
      }),
    );
    expect(v.findings.map((f) => f.severity)).toEqual(["CRÍTICO", "MÉDIO"]);
  });

  it("aceita cabeçalho sem acento (MUDANCAS NECESSARIAS)", () => {
    const v = ok(verdictBody().replace("APROVADO", "MUDANCAS NECESSARIAS"));
    expect(v.outcome).toBe("MUDANÇAS NECESSÁRIAS");
  });

  it("severidade fora da lista → fora do formato", () => {
    expect(invalid(verdictBody({ findings: [[1, "GRAVE"]] }))).toMatch(/severidade/);
  });

  it("# repetido → fora do formato", () => {
    expect(
      invalid(
        verdictBody({
          findings: [
            [1, "BAIXO"],
            [1, "BAIXO"],
          ],
        }),
      ),
    ).toMatch(/#/);
  });

  it("# não inteiro → fora do formato", () => {
    invalid(verdictBody().replace("| — | — | — | — | — | — |", "| 1a | BAIXO | a:1 | X | p | s |"));
  });

  it("tabela de achados com colunas faltando → fora do formato", () => {
    invalid(verdictBody().replace("| — | — | — | — | — | — |", "| 1 | BAIXO | a:1 |"));
  });

  it("coluna OK? fora de ✅/❌ → fora do formato", () => {
    invalid(verdictBody().replace("| ✅ |", "| talvez |"));
  });

  it("❌ na cobertura é lido como ok=false", () => {
    expect(ok(verdictBody().replace("| ✅ |", "| ❌ |")).coverage[0].ok).toBe(false);
  });
});

describe("parseVerdict — Achados anteriores (FR-020)", () => {
  it("lê as situações válidas", () => {
    const v = ok(
      verdictBody({
        previous: [
          [1, "resolvido"],
          [2, "justificativa aceita"],
          [3, "permanece"],
        ],
      }),
    );
    expect(v.previous).toEqual([
      { n: 1, status: "resolvido" },
      { n: 2, status: "justificativa aceita" },
      { n: 3, status: "permanece" },
    ]);
  });

  it("ausente ⇒ lista vazia", () => {
    expect(ok(verdictBody()).previous).toEqual([]);
  });

  it("situação fora da lista → fora do formato", () => {
    expect(invalid(verdictBody({ previous: [[1, "ignorado"]] }))).toMatch(/situação/);
  });

  it("# repetido em Achados anteriores → fora do formato", () => {
    invalid(
      verdictBody({
        previous: [
          [1, "resolvido"],
          [1, "permanece"],
        ],
      }),
    );
  });
});

describe("parseVerdict — Claude (prumo-revisor)", () => {
  const inputs = ["diff.patch (sha256: abc)", "spec/spec.md (sha256: def)"];

  it("exige head= no marcador", () => {
    expect(invalid(verdictBody({ inputs }), "claude")).toMatch(/head=/);
  });

  it("exige Insumos lidos", () => {
    expect(invalid(verdictBody({ head: HEAD }), "claude")).toMatch(/Insumos/);
  });

  it("válido com head= e Insumos lidos (só o caminho de cada item)", () => {
    const v = ok(verdictBody({ head: HEAD, inputs }), "claude");
    expect(v.markerHead).toBe(HEAD);
    expect(v.inputsRead).toEqual(["diff.patch", "spec/spec.md"]);
  });

  it("head= que não é sha de 40 hex → fora do formato", () => {
    invalid(verdictBody({ head: "abc123", inputs }), "claude");
  });
});

describe("inlineSeverity — selos do Gemini", () => {
  it.each([
    ["critical", "CRÍTICO"],
    ["high", "ALTO"],
    ["medium", "MÉDIO"],
    ["low", "BAIXO"],
  ])("%s-priority.svg → %s", (sev, expected) => {
    expect(
      inlineSeverity(`![x](https://www.gstatic.com/codereviewagent/${sev}-priority.svg) texto`),
    ).toBe(expected);
  });

  it("sem selo → null", () => {
    expect(inlineSeverity("comentário sem selo")).toBeNull();
  });
});

describe("exemplos de docs/review-checklist.md (fonte única do formato — T029)", () => {
  const blocks = () =>
    [
      ...readFileSync(path.resolve(__dirname, "../../../docs/review-checklist.md"), "utf8")
        .replace(/\r\n/g, "\n")
        .matchAll(/```markdown\n([\s\S]*?)```/g),
    ].map((m) => m[1]);

  it("o modelo, preenchido com um resultado, é aceito pelo parser (Gemini)", () => {
    const model = blocks().find((b) => b.startsWith("<!-- prumo:veredito v1 -->"))!;
    expect(
      parseVerdict(model.replace("APROVADO | MUDANÇAS NECESSÁRIAS", "APROVADO"), "gemini").status,
    ).toBe("ok");
  });

  it("o exemplo do Claude limpo é aceito com head= e Insumos lidos", () => {
    const example = blocks().find((b) => b.includes("head="))!;
    const r = parseVerdict(example, "claude");
    expect(r.status).toBe("ok");
    if (r.status === "ok") {
      expect(r.verdict.findings.map((f) => f.severity)).toEqual(["ALTO", "BAIXO"]);
      expect(r.verdict.inputsRead).toEqual(["diff.patch", "spec/spec.md", "constitution.md"]);
    }
  });
});
