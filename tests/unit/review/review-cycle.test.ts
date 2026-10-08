// T046 · US5 — ciclo achado → resposta → nova revisão, casos não cobertos por T011 (FR-019, FR-020).
import { describe, expect, it } from "vitest";
import { evaluateGate } from "../../../src/review/evaluate-gate";
import {
  HEAD,
  OLD_HEAD,
  geminiReview,
  issueComment,
  makeSnapshot,
  responsesBody,
  users,
  verdictBody,
} from "./fixtures";

const at = (h: number) => `2026-10-06T${String(h).padStart(2, "0")}:00:00Z`;
const JUST = "Justificativa técnica com mais de vinte caracteres.";
const SHA7 = HEAD.slice(0, 7);
const review = (id: number, h: number, body: string, commit = HEAD) =>
  geminiReview({ id, at: at(h), commit, body });
const changes = (findings: [number, string][], previous?: [number, string][]) =>
  verdictBody({ outcome: "MUDANÇAS NECESSÁRIAS", findings, previous });
const answer = (id: number, h: number, lines: [number, string, string][], user = users.doug) =>
  issueComment({ id, at: at(h), body: responsesBody(lines), user });

describe("ciclo achado → resposta → nova revisão", () => {
  it("duas rodadas de MUDANÇAS seguidas: só a mais recente conta", () => {
    const base = {
      reviews: [
        review(
          1,
          10,
          changes([
            [1, "ALTO"],
            [2, "MÉDIO"],
          ]),
          OLD_HEAD,
        ),
        review(
          2,
          12,
          changes(
            [[1, "ALTO"]],
            [
              [1, "resolvido"],
              [2, "permanece"],
            ],
          ),
          OLD_HEAD,
        ),
        review(3, 14, verdictBody({ previous: [[1, "resolvido"]] })),
      ],
    };
    // respostas só para a 1ª rodada (antes da 2ª) ⇒ o #1 da 2ª fica sem resposta
    const stale = makeSnapshot({
      ...base,
      issueComments: [
        answer(5, 11, [
          [1, "corrigido", SHA7],
          [2, "justificado", JUST],
        ]),
      ],
    });
    expect(evaluateGate(stale).reason).toBe("achados sem resposta: #1");
    const fresh = makeSnapshot({
      ...base,
      issueComments: [
        answer(5, 11, [[1, "corrigido", SHA7]]),
        answer(6, 13, [[1, "corrigido", SHA7]]),
      ],
    });
    expect(evaluateGate(fresh).state).toBe("success");
  });

  it("respostas espalhadas em vários comentários se somam", () => {
    const s = makeSnapshot({
      reviews: [
        review(
          1,
          10,
          changes([
            [1, "ALTO"],
            [2, "BAIXO"],
            [3, "MÉDIO"],
          ]),
          OLD_HEAD,
        ),
        review(
          2,
          14,
          verdictBody({
            previous: [
              [1, "resolvido"],
              [2, "resolvido"],
              [3, "justificativa aceita"],
            ],
          }),
        ),
      ],
      issueComments: [
        answer(5, 11, [[1, "corrigido", SHA7]]),
        answer(6, 12, [[2, "corrigido", SHA7]]),
        answer(7, 13, [[3, "justificado", JUST]]),
      ],
    });
    expect(evaluateGate(s).state).toBe("success");
  });

  it("resposta publicada antes do veredito que pretende cobrir não conta", () => {
    const s = makeSnapshot({
      reviews: [
        review(1, 10, changes([[1, "ALTO"]]), OLD_HEAD),
        review(2, 14, verdictBody({ previous: [[1, "resolvido"]] })),
      ],
      issueComments: [answer(5, 9, [[1, "corrigido", SHA7]])],
    });
    expect(evaluateGate(s).reason).toBe("achados sem resposta: #1");
  });

  it("corrigido com sha fora dos commits do PR não conta", () => {
    const s = makeSnapshot({
      reviews: [
        review(1, 10, changes([[1, "ALTO"]]), OLD_HEAD),
        review(2, 14, verdictBody({ previous: [[1, "resolvido"]] })),
      ],
      issueComments: [answer(5, 11, [[1, "corrigido", "1234567"]])],
    });
    expect(evaluateGate(s).reason).toBe("achados sem resposta: #1");
  });

  it("resposta de conta ≠ dougueta não conta", () => {
    const s = makeSnapshot({
      reviews: [
        review(1, 10, changes([[1, "ALTO"]]), OLD_HEAD),
        review(2, 14, verdictBody({ previous: [[1, "resolvido"]] })),
      ],
      issueComments: [answer(5, 11, [[1, "justificado", JUST]], users.thirdParty)],
    });
    expect(evaluateGate(s).reason).toBe("achados sem resposta: #1");
  });

  it("responder o achado que faltava libera o fluxo sem nova revisão", () => {
    const s = makeSnapshot({
      reviews: [
        review(
          1,
          10,
          changes([
            [1, "ALTO"],
            [2, "ALTO"],
            [3, "ALTO"],
          ]),
          OLD_HEAD,
        ),
        review(
          2,
          14,
          verdictBody({
            previous: [
              [1, "resolvido"],
              [2, "resolvido"],
              [3, "justificativa aceita"],
            ],
          }),
        ),
      ],
      issueComments: [
        answer(5, 11, [
          [1, "corrigido", SHA7],
          [2, "corrigido", SHA7],
        ]),
      ],
    });
    expect(evaluateGate(s).reason).toBe("achados sem resposta: #3");
    s.issueComments.push(answer(6, 15, [[3, "justificado", JUST]]));
    expect(evaluateGate(s).state).toBe("success");
  });

  it("justificativa aceita ⇒ success; permanece com o achado ALTO relistado ⇒ failure", () => {
    const first = review(1, 10, changes([[1, "ALTO"]]), OLD_HEAD);
    const resp = answer(5, 11, [[1, "justificado", JUST]]);
    const accepted = makeSnapshot({
      reviews: [first, review(2, 14, verdictBody({ previous: [[1, "justificativa aceita"]] }))],
      issueComments: [resp],
    });
    expect(evaluateGate(accepted).state).toBe("success");
    const remains = makeSnapshot({
      reviews: [first, review(2, 14, changes([[1, "ALTO"]], [[1, "permanece"]]))],
      issueComments: [resp],
    });
    expect(evaluateGate(remains)).toMatchObject({
      state: "failure",
      reason: "mudanças necessárias: 1 achado(s) (1 ALTO)",
    });
  });
});
