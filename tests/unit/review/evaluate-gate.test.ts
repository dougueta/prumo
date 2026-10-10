// T011 · contracts/review-gate.md — tabela de decisão de evaluateGate
// (FR-002, FR-006–FR-013, FR-020, FR-024, FR-026).
import { describe, expect, it } from "vitest";
import { evaluateGate } from "../../../src/review/evaluate-gate";
import {
  HEAD,
  OLD_HEAD,
  constitutionPatch,
  geminiReview,
  inlineComment,
  issueComment,
  makeSnapshot,
  responsesBody,
  trailers,
  users,
  verdictBody,
} from "./fixtures";

const T1 = "2026-10-06T10:00:00Z";
const T2 = "2026-10-06T11:00:00Z";
const T3 = "2026-10-06T12:00:00Z";
const T4 = "2026-10-06T13:00:00Z";
const changes = (findings: [number, string][]) =>
  verdictBody({ outcome: "MUDANÇAS NECESSÁRIAS", findings });
const gem = (id: number, at: string, body: string, commit = HEAD) =>
  geminiReview({ id, at, commit, body });
const claudeComment = (id: number, at: string, head = HEAD, extra: object = {}) =>
  issueComment({
    id,
    at,
    user: users.revisor,
    body: verdictBody({ head, inputs: ["diff.patch (sha256: x)"], ...extra }),
  });
const geminiPr = (over = {}) =>
  makeSnapshot({
    labels: ["autor:gemini", "iniciativa:3"],
    headRef: "010-importacao-pdf-fatura",
    commits: [{ sha: HEAD, message: trailers.gemini }],
    reviews: [],
    issueComments: [claudeComment(10, T1)],
    ...over,
  });

describe("evaluateGate — caminho feliz (regra 14)", () => {
  it("APROVADO pelo Gemini no head atual", () => {
    expect(evaluateGate(makeSnapshot())).toMatchObject({
      state: "success",
      reason: `APROVADO por Gemini em ${HEAD.slice(0, 7)}`,
      kind: "feature",
      designatedReviewer: "gemini",
      touchesGate: false,
      emergency: false,
      warnings: [],
    });
  });

  it("APROVADO pelo Claude (prumo-revisor) em PR autor:gemini", () => {
    expect(evaluateGate(geminiPr())).toMatchObject({
      state: "success",
      reason: `APROVADO por Claude (prumo-revisor) em ${HEAD.slice(0, 7)}`,
      designatedReviewer: "claude",
    });
  });

  it("autor:doug é revisado pelo Gemini", () => {
    const s = makeSnapshot({
      labels: ["autor:doug", "iniciativa:0"],
      commits: [{ sha: HEAD, message: trailers.none }],
    });
    expect(evaluateGate(s).state).toBe("success");
  });

  it("achados MÉDIO/BAIXO não impedem APROVADO", () => {
    const body = verdictBody({
      findings: [
        [1, "MÉDIO"],
        [2, "BAIXO"],
      ],
    });
    expect(evaluateGate(makeSnapshot({ reviews: [gem(1, T1, body)] })).state).toBe("success");
  });
});

describe("evaluateGate — regras estruturais (0–7)", () => {
  it("0: autor externo ⇒ failure, antes de rascunho e rótulos", () => {
    const r = evaluateGate(makeSnapshot({ authorLogin: "terceiro", draft: true, labels: [] }));
    expect(r).toMatchObject({ state: "failure", reason: "PR de autor externo — não aceito" });
  });

  it("0: branch de fork (ou fork apagado) ⇒ failure", () => {
    expect(evaluateGate(makeSnapshot({ headRepoFullName: "terceiro/prumo" })).reason).toBe(
      "PR de autor externo — não aceito",
    );
    expect(evaluateGate(makeSnapshot({ headRepoFullName: null })).state).toBe("failure");
  });

  it("1: rascunho ⇒ pending", () => {
    expect(evaluateGate(makeSnapshot({ draft: true, labels: [] }))).toMatchObject({
      state: "pending",
      reason: "PR em rascunho — revisão começa quando estiver pronto",
    });
  });

  it("2: 0 ou >1 rótulos autor:* ⇒ failure", () => {
    for (const labels of [["iniciativa:0"], ["autor:claude", "autor:gemini", "iniciativa:0"]]) {
      expect(evaluateGate(makeSnapshot({ labels }))).toMatchObject({
        state: "failure",
        reason: "rótulo de autor ausente ou ambíguo",
      });
    }
  });

  it("3: commits de dois agentes ⇒ failure", () => {
    const s = makeSnapshot({
      commits: [
        { sha: HEAD, message: trailers.claude },
        { sha: OLD_HEAD, message: trailers.gemini },
      ],
    });
    expect(evaluateGate(s)).toMatchObject({
      state: "failure",
      reason: "PR com mais de um agente autor",
    });
  });

  it("4: rótulo inconsistente com os commits ⇒ failure", () => {
    const s = makeSnapshot({ labels: ["autor:gemini", "iniciativa:0"] });
    expect(evaluateGate(s)).toMatchObject({
      state: "failure",
      reason: "rótulo de autor inconsistente com os commits",
    });
    const doug = makeSnapshot({ labels: ["autor:doug", "iniciativa:0"] });
    expect(evaluateGate(doug).reason).toBe("rótulo de autor inconsistente com os commits");
  });

  it("5: feature sem iniciativa:N ⇒ failure (iniciativa:11 não vale)", () => {
    for (const labels of [["autor:claude"], ["autor:claude", "iniciativa:11"]]) {
      expect(evaluateGate(makeSnapshot({ labels }))).toMatchObject({
        state: "failure",
        reason: "rótulo de iniciativa ausente",
      });
    }
  });

  it("6: feature sem spec (branch fora do padrão ou spec ausente) ⇒ failure", () => {
    expect(evaluateGate(makeSnapshot({ specExists: false })).reason).toBe(
      "PR sem spec (Constitution I)",
    );
    expect(evaluateGate(makeSnapshot({ headRef: "minha-branch" })).reason).toBe(
      "PR sem spec (Constitution I)",
    );
  });

  it("processo: dispensa spec e iniciativa, mas exige rótulo de autor e veredito", () => {
    const s = makeSnapshot({
      labels: ["autor:claude"],
      headRef: "docs/ajuste",
      specExists: false,
      changedFiles: ["docs/workflow.md"],
    });
    expect(evaluateGate(s)).toMatchObject({ state: "success", kind: "processo" });
    expect(evaluateGate({ ...s, reviews: [] }).reason).toBe("aguardando veredito de Gemini");
  });

  it("7: emenda sem versão/Sync Impact Report ⇒ failure", () => {
    const s = makeSnapshot({
      labels: ["autor:claude"],
      headRef: "emenda-x",
      changedFiles: [".specify/memory/constitution.md"],
      constitutionPatch: constitutionPatch.unversioned,
    });
    expect(evaluateGate(s)).toMatchObject({
      state: "failure",
      kind: "emenda",
      reason: "emenda sem versão/Sync Impact Report atualizados",
    });
  });

  it("emenda com versão e Sync Impact Report segue para o veredito", () => {
    const s = makeSnapshot({
      labels: ["autor:claude"],
      headRef: "emenda-x",
      changedFiles: [".specify/memory/constitution.md"],
      constitutionPatch: constitutionPatch.versioned,
    });
    expect(evaluateGate(s)).toMatchObject({ state: "success", kind: "emenda" });
  });
});

describe("evaluateGate — emergência (8–9, FR-024)", () => {
  const motivo = "Motivo da emergência: produção fora do ar ao abrir o extrato";
  const emerg = (over = {}) =>
    makeSnapshot({
      labels: ["autor:claude", "iniciativa:3", "emergencia"],
      headRef: "012-extrato-consolidado",
      body: motivo,
      reviews: [],
      ...over,
    });

  it("8: rótulo + motivo ≥ 20 caracteres, sem tocar mecanismos ⇒ success com emergency", () => {
    expect(evaluateGate(emerg())).toMatchObject({
      state: "success",
      reason: "EMERGÊNCIA — revisão independente pós-merge em até 7 dias",
      emergency: true,
    });
  });

  it("9: sem motivo (ou motivo curto) ⇒ failure", () => {
    for (const body of ["", "Motivo da emergência: urgente"]) {
      expect(evaluateGate(emerg({ body }))).toMatchObject({
        state: "failure",
        reason: "emergência sem motivo registrado no PR",
      });
    }
  });

  it("9 (trava): PR que toca mecanismos de revisão ⇒ failure, mesmo com motivo", () => {
    const r = evaluateGate(emerg({ changedFiles: ["src/review/evaluate-gate.ts"] }));
    expect(r).toMatchObject({
      state: "failure",
      reason: "emergência não vale para PR que altera a constitution ou os mecanismos de revisão",
      touchesGate: true,
    });
  });

  it.each(["package.json", "package-lock.json"])(
    "9 (trava): PR que altera %s (scripts executados pelos workflows) ⇒ failure",
    (file) => {
      const r = evaluateGate(emerg({ changedFiles: ["src/app/page.tsx", file] }));
      expect(r).toMatchObject({
        state: "failure",
        reason: "emergência não vale para PR que altera a constitution ou os mecanismos de revisão",
        touchesGate: true,
      });
    },
  );

  it("9 (trava): emenda da constitution ⇒ failure", () => {
    const r = evaluateGate(
      emerg({
        changedFiles: [".specify/memory/constitution.md"],
        constitutionPatch: constitutionPatch.versioned,
      }),
    );
    expect(r.reason).toBe(
      "emergência não vale para PR que altera a constitution ou os mecanismos de revisão",
    );
  });

  it("regras 0–7 valem também para emergências", () => {
    expect(evaluateGate(emerg({ specExists: false })).reason).toBe("PR sem spec (Constitution I)");
    expect(evaluateGate(emerg({ authorLogin: "terceiro" })).reason).toBe(
      "PR de autor externo — não aceito",
    );
  });
});

describe("evaluateGate — veredito (10–14)", () => {
  it("10: sem veredito ⇒ pending aguardando o revisor designado", () => {
    expect(evaluateGate(makeSnapshot({ reviews: [] }))).toMatchObject({
      state: "pending",
      reason: "aguardando veredito de Gemini",
    });
    expect(evaluateGate(geminiPr({ issueComments: [] })).reason).toBe(
      "aguardando veredito de Claude (prumo-revisor)",
    );
  });

  it("10: review do Gemini sem bloco não é veredito", () => {
    const s = makeSnapshot({ reviews: [gem(1, T1, "## Code Review\n\nTudo certo.")] });
    expect(evaluateGate(s)).toMatchObject({ state: "pending", warnings: [] });
  });

  it("11: veredito de outro head sem impressão equivalente ⇒ pending desatualizado", () => {
    const s = makeSnapshot({
      reviews: [gem(1, T1, verdictBody(), OLD_HEAD)],
      fingerprints: { [HEAD]: "fp-novo", [OLD_HEAD]: "fp-antigo" },
    });
    expect(evaluateGate(s)).toMatchObject({
      state: "pending",
      reason: "veredito desatualizado — novo commit após a revisão",
    });
  });

  it("11: impressão null (não comprovável) ⇒ pending", () => {
    const s = makeSnapshot({
      reviews: [gem(1, T1, verdictBody(), OLD_HEAD)],
      fingerprints: { [HEAD]: null, [OLD_HEAD]: null },
    });
    expect(evaluateGate(s).state).toBe("pending");
  });

  it("11: rebase neutro (impressões iguais) ⇒ success com sufixo", () => {
    const s = makeSnapshot({
      reviews: [gem(1, T1, verdictBody(), OLD_HEAD)],
      fingerprints: { [HEAD]: "fp", [OLD_HEAD]: "fp" },
    });
    expect(evaluateGate(s)).toMatchObject({
      state: "success",
      reason: `APROVADO por Gemini em ${OLD_HEAD.slice(0, 7)} (rebase neutro)`,
    });
  });

  it("11: Claude usa o head= do marcador", () => {
    const s = geminiPr({ issueComments: [claudeComment(10, T1, OLD_HEAD)] });
    expect(evaluateGate(s).reason).toBe("veredito desatualizado — novo commit após a revisão");
  });

  it("12: MUDANÇAS NECESSÁRIAS ⇒ failure com contagem por severidade", () => {
    const s = makeSnapshot({
      reviews: [
        gem(
          1,
          T1,
          changes([
            [1, "CRÍTICO"],
            [2, "ALTO"],
            [3, "ALTO"],
          ]),
        ),
      ],
    });
    expect(evaluateGate(s)).toMatchObject({
      state: "failure",
      reason: "mudanças necessárias: 3 achado(s) (1 CRÍTICO, 2 ALTO)",
    });
  });

  it("12: APROVADO com achado ALTO na tabela ⇒ incoerente ⇒ failure + aviso", () => {
    const s = makeSnapshot({ reviews: [gem(1, T1, verdictBody({ findings: [[1, "ALTO"]] }))] });
    const r = evaluateGate(s);
    expect(r.state).toBe("failure");
    expect(r.reason).toMatch(/^mudanças necessárias/);
    expect(r.warnings).toContain("veredito incoerente: APROVADO com achado CRÍTICO/ALTO");
  });

  it("12: APROVADO com selo high-priority em comentário de linha da mesma review ⇒ incoerente", () => {
    const s = makeSnapshot({
      reviewComments: [inlineComment({ id: 100, reviewId: 1, sev: "high" })],
    });
    const r = evaluateGate(s);
    expect(r).toMatchObject({
      state: "failure",
      reason: "mudanças necessárias: 1 achado(s) (1 ALTO)",
    });
  });

  it("selo de outra review não contamina o veredito", () => {
    const s = makeSnapshot({
      reviewComments: [inlineComment({ id: 100, reviewId: 999, sev: "critical" })],
    });
    expect(evaluateGate(s).state).toBe("success");
  });

  it("13: achados do MUDANÇAS anterior sem resposta ⇒ failure", () => {
    const s = makeSnapshot({
      reviews: [
        gem(
          1,
          T1,
          changes([
            [1, "ALTO"],
            [2, "MÉDIO"],
            [3, "BAIXO"],
          ]),
          OLD_HEAD,
        ),
        gem(
          2,
          T3,
          verdictBody({
            previous: [
              [1, "resolvido"],
              [2, "resolvido"],
              [3, "resolvido"],
            ],
          }),
        ),
      ],
      issueComments: [
        issueComment({
          id: 5,
          at: T2,
          body: responsesBody([
            [1, "corrigido", HEAD.slice(0, 7)],
            [2, "justificado", "Justificativa técnica com mais de vinte caracteres."],
          ]),
        }),
      ],
    });
    expect(evaluateGate(s)).toMatchObject({ state: "failure", reason: "achados sem resposta: #3" });
  });

  it("vale o veredito mais recente do revisor designado", () => {
    const s = makeSnapshot({
      reviews: [gem(1, T1, verdictBody()), gem(2, T2, changes([[1, "ALTO"]]))],
    });
    expect(evaluateGate(s).state).toBe("failure");
  });
});

describe("evaluateGate — validade e avisos (FR-009, FR-010, FR-020)", () => {
  it("re-revisão sem Achados anteriores completos é desconsiderada", () => {
    const s = makeSnapshot({
      reviews: [
        gem(
          1,
          T1,
          changes([
            [1, "ALTO"],
            [2, "MÉDIO"],
          ]),
        ),
        gem(2, T3, verdictBody({ previous: [[1, "resolvido"]] })),
      ],
    });
    const r = evaluateGate(s);
    expect(r).toMatchObject({
      state: "failure",
      reason: "mudanças necessárias: 2 achado(s) (1 ALTO, 1 MÉDIO)",
    });
    expect(r.warnings).toContain("veredito fora do formato (Achados anteriores incompletos)");
  });

  it("comentário do Doug com bloco de veredito ⇒ ignorado com aviso", () => {
    const s = makeSnapshot({
      reviews: [],
      issueComments: [issueComment({ id: 1, at: T1, body: verdictBody() })],
    });
    const r = evaluateGate(s);
    expect(r).toMatchObject({ state: "pending", reason: "aguardando veredito de Gemini" });
    expect(r.warnings).toEqual([
      "veredito de dougueta (conta dos autores) desconsiderado: não é o revisor designado",
    ]);
  });

  it("veredito do agente autor (prumo-revisor em PR autor:claude) ⇒ ignorado com aviso", () => {
    const s = makeSnapshot({ reviews: [], issueComments: [claudeComment(9, T1)] });
    const r = evaluateGate(s);
    expect(r.state).toBe("pending");
    expect(r.warnings).toEqual([
      "veredito de Claude (prumo-revisor) desconsiderado: não é o revisor designado",
    ]);
  });

  it("login parecido com o do bot, mas type User ⇒ não é o revisor", () => {
    const s = makeSnapshot({
      reviews: [geminiReview({ id: 1, at: T1, user: users.fakeGemini })],
    });
    expect(evaluateGate(s).state).toBe("pending");
  });

  it("veredito fora do formato ⇒ ignorado com aviso", () => {
    const s = makeSnapshot({
      reviews: [gem(1, T1, verdictBody({ findings: [[1, "GRAVE"]] }))],
    });
    const r = evaluateGate(s);
    expect(r.state).toBe("pending");
    expect(r.warnings).toEqual(["veredito fora do formato (severidade inválida)"]);
  });

  it("veredito do Gemini em comentário (não review) ⇒ fora do formato", () => {
    const s = makeSnapshot({
      reviews: [],
      issueComments: [issueComment({ id: 1, at: T1, user: users.gemini, body: verdictBody() })],
    });
    expect(evaluateGate(s).warnings[0]).toMatch(/^veredito fora do formato/);
  });

  it("comentário prumo:avisos nunca é veredito", () => {
    const s = makeSnapshot({
      reviews: [],
      issueComments: [
        issueComment({
          id: 1,
          at: T1,
          user: users.actions,
          body: "<!-- prumo:avisos v1 -->\n" + verdictBody(),
        }),
      ],
    });
    expect(evaluateGate(s)).toMatchObject({ state: "pending", warnings: [] });
  });

  it("PR que toca o portão recebe aviso de revisão manual", () => {
    const s = makeSnapshot({
      changedFiles: ["src/review/catalog.ts", "specs/999-exemplo/spec.md"],
    });
    const r = evaluateGate(s);
    expect(r.touchesGate).toBe(true);
    expect(r.warnings).toContain(
      "PR altera o portão ou os revisores — revisão manual do Doug obrigatória",
    );
  });

  it("rótulo de autor trocado: o veredito do revisor anterior deixa de valer", () => {
    const s = makeSnapshot({
      labels: ["autor:gemini", "iniciativa:0"],
      commits: [{ sha: HEAD, message: trailers.gemini }],
    });
    const r = evaluateGate(s);
    expect(r.reason).toBe("aguardando veredito de Claude (prumo-revisor)");
    expect(r.warnings[0]).toMatch(/^veredito de Gemini desconsiderado/);
  });
});

describe("evaluateGate — saídas seguras (FR-008, FR-026)", () => {
  it("reason ≤ 140 caracteres", () => {
    const many = Array.from({ length: 60 }, (_, i) => [i + 1, "BAIXO"] as [number, string]);
    const s = makeSnapshot({
      reviews: [
        gem(1, T1, changes(many), OLD_HEAD),
        gem(2, T4, verdictBody({ previous: many.map(([n]) => [n, "resolvido"]) })),
      ],
    });
    const r = evaluateGate(s);
    expect(r.reason.startsWith("achados sem resposta: #1, #2")).toBe(true);
    expect(r.reason.length).toBeLessThanOrEqual(140);
  });

  it("título, corpo e branch do PR nunca aparecem em reason/avisos", () => {
    const evil = "$(curl evil) `rm -rf` <script>";
    const scenarios = [
      makeSnapshot({ body: evil, headRef: "999-x" }),
      makeSnapshot({ body: evil, headRef: evil, specExists: false }),
      makeSnapshot({
        reviews: [],
        issueComments: [issueComment({ id: 1, at: T1, body: `${evil}\n${verdictBody()}` })],
      }),
      makeSnapshot({
        reviews: [gem(1, T1, `${evil}\n${verdictBody({ findings: [[1, "GRAVE"]] })}`)],
      }),
    ];
    for (const s of scenarios) {
      const r = evaluateGate(s);
      expect(JSON.stringify([r.reason, r.warnings])).not.toMatch(/curl|rm -rf|script/);
    }
  });
});
