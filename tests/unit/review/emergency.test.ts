// T049 · FR-024 — modo agendado do main-guard: revisões pós-merge de emergência.
import { describe, expect, it } from "vitest";
import { runMainGuard } from "../../../scripts/review/main-guard";
import { emergencyAction } from "../../../src/review/main-guard";
import { R, createFakeFetch, type Route } from "./fixtures/fake-fetch";
import {
  HEAD,
  apiCompare,
  apiFiles,
  apiPull,
  geminiReview,
  makeSnapshot,
  trailers,
} from "./fixtures";

const MERGED = "2026-10-01T12:00:00Z";
const pr = (reviews = [geminiReview({ id: 1, at: "2026-10-03T10:00:00Z" })]) =>
  makeSnapshot({
    number: 77,
    merged: true,
    mergedAt: MERGED,
    labels: ["autor:claude", "iniciativa:3", "emergencia"],
    reviews,
  });
const issue = (title = "Revisão pós-merge pendente: #77") => ({ number: 900, title });
const day = (d: number) => new Date(new Date(MERGED).getTime() + d * 86_400_000);

describe("emergencyAction", () => {
  it("veredito válido do revisor designado publicado após o merge ⇒ fecha", () => {
    expect(emergencyAction({ issue: issue(), pr: pr(), now: day(3) })).toEqual({ action: "close" });
  });

  it("veredito anterior ao merge não regulariza", () => {
    const old = [geminiReview({ id: 1, at: "2026-09-30T10:00:00Z" })];
    expect(emergencyAction({ issue: issue(), pr: pr(old), now: day(3) })).toEqual({
      action: "none",
    });
  });

  it("dentro do prazo sem veredito ⇒ pendente (nada a fazer)", () => {
    expect(emergencyAction({ issue: issue(), pr: pr([]), now: day(6) })).toEqual({
      action: "none",
    });
  });

  it("mais de 7 dias sem veredito ⇒ VENCIDA", () => {
    expect(emergencyAction({ issue: issue(), pr: pr([]), now: day(8) })).toEqual({
      action: "overdue",
    });
  });

  it("idempotente: já VENCIDA não é marcada de novo", () => {
    const t = "VENCIDA — Revisão pós-merge pendente: #77";
    expect(emergencyAction({ issue: issue(t), pr: pr([]), now: day(9) })).toEqual({
      action: "none",
    });
  });

  it("VENCIDA que recebe veredito ⇒ fecha", () => {
    const t = "VENCIDA — Revisão pós-merge pendente: #77";
    const late = [geminiReview({ id: 1, at: day(10).toISOString() })];
    expect(emergencyAction({ issue: issue(t), pr: pr(late), now: day(11) })).toEqual({
      action: "close",
    });
  });
});

describe("runMainGuard (schedule)", () => {
  const P = `${R}/pulls/77`;
  function routes(
    reviews: unknown[],
    title = "Revisão pós-merge pendente: #77",
  ): Record<string, Route> {
    return {
      [`GET ${R}/issues`]: {
        body: [
          { number: 900, title },
          { number: 901, title: "outra", pull_request: {} },
        ],
      },
      [`GET ${P}`]: {
        body: apiPull({
          number: 77,
          merged_at: MERGED,
          state: "closed",
          labels: [{ name: "autor:claude" }, { name: "iniciativa:3" }, { name: "emergencia" }],
        }),
      },
      [`GET ${P}/commits`]: { body: [{ sha: HEAD, commit: { message: trailers.claude } }] },
      [`GET ${P}/files`]: { body: apiFiles },
      [`GET ${P}/reviews`]: { body: reviews },
      [`GET ${P}/comments`]: { body: [] },
      [`GET ${R}/issues/77/comments`]: { body: [] },
      [`GET ${R}/contents/specs/999-exemplo/spec.md`]: { body: { content: "" } },
      [`GET ${R}/compare/main...${HEAD}`]: { body: apiCompare() },
      [`PATCH ${R}/issues/900`]: { body: {} },
      [`POST ${R}/issues/900/comments`]: { status: 201, body: {} },
    };
  }
  async function run(r: Record<string, Route>, now: Date) {
    const fake = createFakeFetch(r);
    const code = await runMainGuard({
      mode: "schedule",
      env: { GITHUB_TOKEN: "tok" },
      fetch: fake.fetch,
      sleep: async () => {},
      log: () => {},
      now: () => now,
    });
    return { code, writes: fake.calls.filter((c) => c.method !== "GET"), calls: fake.calls };
  }

  it("fecha a issue com comentário quando há veredito pós-merge", async () => {
    const { code, writes, calls } = await run(
      routes([geminiReview({ id: 1, at: "2026-10-03T10:00:00Z" })]),
      day(3),
    );
    expect(code).toBe(0);
    expect(calls[0].query).toContain("labels=emergencia");
    expect(writes.map((w) => `${w.method} ${w.path}`)).toEqual([
      `POST ${R}/issues/900/comments`,
      `PATCH ${R}/issues/900`,
    ]);
    expect(writes[1].body).toEqual({ state: "closed" });
    expect((writes[0].body as { body: string }).body).toContain("#77");
  });

  it("vencida: prefixa VENCIDA — e comenta mencionando @dougueta", async () => {
    const { writes } = await run(routes([]), day(8));
    expect(writes.find((w) => w.method === "PATCH")!.body).toEqual({
      title: "VENCIDA — Revisão pós-merge pendente: #77",
    });
    expect((writes.find((w) => w.method === "POST")!.body as { body: string }).body).toContain(
      "@dougueta",
    );
  });

  it("idempotente: issue já VENCIDA e sem veredito ⇒ nenhuma escrita", async () => {
    const { writes } = await run(routes([], "VENCIDA — Revisão pós-merge pendente: #77"), day(9));
    expect(writes).toEqual([]);
  });
});
