// T007 · contracts/veredito.md §2 — resposta do autor (FR-019).
import { describe, expect, it } from "vitest";
import { answeredFindings, parseResponses } from "../../../src/review/parse-responses";
import { issueComment, responsesBody, users } from "./fixtures";

const JUST = "O FR-012 dispensa spec para PR de processo; o arquivo está em docs/.";
const at = "2026-10-06T12:00:00Z";

describe("parseResponses", () => {
  it("lê corrigido (sha 7–40 hex) e justificado (≥ 20 caracteres)", () => {
    const r = parseResponses(
      issueComment({
        id: 1,
        at,
        body: responsesBody([
          [1, "corrigido", "3f2a9c1"],
          [2, "justificado", JUST],
          [3, "corrigido", "a".repeat(40)],
        ]),
      }),
    );
    expect(r).toEqual({
      authorLogin: "dougueta",
      publishedAt: at,
      lines: [
        { n: 1, action: "corrigido", ref: "3f2a9c1" },
        { n: 2, action: "justificado", ref: JUST },
        { n: 3, action: "corrigido", ref: "a".repeat(40) },
      ],
    });
  });

  it("descarta linhas inválidas: sha curto/não hex, justificativa curta, ação desconhecida", () => {
    const r = parseResponses(
      issueComment({
        id: 1,
        at,
        body: responsesBody([
          [1, "corrigido", "3f2a9c"],
          [2, "corrigido", "zzzzzzz"],
          [3, "justificado", "curta demais"],
          [4, "ignorado", JUST],
          [5, "corrigido", "3f2a9c1"],
        ]),
      }),
    );
    expect(r?.lines.map((l) => l.n)).toEqual([5]);
  });

  it("aceita ação com maiúsculas (Corrigido)", () => {
    const r = parseResponses(
      issueComment({ id: 1, at, body: responsesBody([[1, "Corrigido", "3f2a9c1"]]) }),
    );
    expect(r?.lines[0].action).toBe("corrigido");
  });

  it("sem marcador → null", () => {
    expect(parseResponses(issueComment({ id: 1, at, body: "| 1 | corrigido | 3f2a9c1 |" }))).toBe(
      null,
    );
  });

  it("autor ≠ dougueta é ignorado (null)", () => {
    for (const user of [users.thirdParty, users.gemini, users.revisor]) {
      expect(
        parseResponses(
          issueComment({ id: 1, at, user, body: responsesBody([[1, "corrigido", "3f2a9c1"]]) }),
        ),
      ).toBeNull();
    }
  });
});

describe("answeredFindings", () => {
  const commits = ["3f2a9c1" + "0".repeat(33), "b".repeat(40)];

  it("une várias respostas", () => {
    const a = parseResponses(
      issueComment({ id: 1, at, body: responsesBody([[1, "corrigido", "3f2a9c1"]]) }),
    )!;
    const b = parseResponses(
      issueComment({ id: 2, at, body: responsesBody([[2, "justificado", JUST]]) }),
    )!;
    expect([...answeredFindings([a, b], commits)].sort()).toEqual([1, 2]);
  });

  it("corrigido com sha fora dos commits do PR não conta", () => {
    const a = parseResponses(
      issueComment({ id: 1, at, body: responsesBody([[1, "corrigido", "c".repeat(7)]]) }),
    )!;
    expect([...answeredFindings([a], commits)]).toEqual([]);
  });
});
