// T041 · data-model §5 — rótulos e marcos (FR-022).
import { describe, expect, it, vi } from "vitest";
import { runLabels } from "../../../scripts/review/labels";
import {
  DESIRED_LABELS,
  DESIRED_MILESTONES,
  planLabels,
  planMilestones,
} from "../../../src/review/labels";
import { R, createFakeFetch, type Route } from "./fixtures/fake-fetch";

describe("estado desejado", () => {
  it("rótulos de autor, emergencia, violacao-main e iniciativa:0..10", () => {
    const names = DESIRED_LABELS.map((l) => l.name);
    expect(names).toEqual([
      "autor:claude",
      "autor:gemini",
      "autor:doug",
      "emergencia",
      "violacao-main",
      ...Array.from({ length: 11 }, (_, i) => `iniciativa:${i}`),
    ]);
    for (const l of DESIRED_LABELS) {
      expect(l.color).toMatch(/^[0-9A-F]{6}$/);
      expect(l.description.length).toBeLessThanOrEqual(100);
    }
  });

  it("11 marcos, um por iniciativa", () => {
    expect(DESIRED_MILESTONES).toHaveLength(11);
    expect(DESIRED_MILESTONES[0]).toBe("0 · Plataforma");
    expect(DESIRED_MILESTONES[10]).toBe("10 · Inteligência");
  });
});

describe("planLabels / planMilestones", () => {
  const desired = [
    { name: "a", color: "111111", description: "A" },
    { name: "b", color: "222222", description: "B" },
  ];

  it("cria faltantes, atualiza cor/descrição, nunca apaga", () => {
    const plan = planLabels(
      [
        { name: "a", color: "111111", description: "A" },
        { name: "b", color: "999999", description: "B" },
        { name: "extra", color: "000000", description: "" },
      ],
      desired,
    );
    expect(plan).toEqual({ create: [], update: [desired[1]] });
    expect(planLabels([], desired)).toEqual({ create: desired, update: [] });
  });

  it("compara cor sem diferenciar maiúsculas", () => {
    expect(
      planLabels([{ name: "a", color: "111111", description: "A" }], [desired[0]]).update,
    ).toEqual([]);
    expect(
      planLabels(
        [{ name: "x", color: "abcdef", description: "X" }],
        [{ name: "x", color: "ABCDEF", description: "X" }],
      ).update,
    ).toEqual([]);
  });

  it("marcos: cria só os que faltam", () => {
    expect(
      planMilestones(["0 · Plataforma", "outro"], ["0 · Plataforma", "1 · Autenticação"]),
    ).toEqual(["1 · Autenticação"]);
  });
});

async function run(routes: Record<string, Route>, argv: string[] = []) {
  const fake = createFakeFetch(routes);
  const out: string[] = [];
  const code = await runLabels({
    argv,
    fetch: fake.fetch,
    exec: vi.fn(async () => ({ code: 0, stdout: "tok\n" })),
    sleep: async () => {},
    log: (m) => out.push(m),
  });
  return { code, writes: fake.calls.filter((c) => c.method !== "GET"), out: out.join("\n") };
}

describe("runLabels (npm run gh:labels)", () => {
  const existing = [
    {
      name: "autor:claude",
      color: "D97757",
      description: "PR escrito pelo Claude — revisor: Gemini",
    },
  ];

  it("--dry-run mostra o diff e não escreve", async () => {
    const { code, writes, out } = await run(
      { [`GET ${R}/labels`]: { body: existing }, [`GET ${R}/milestones`]: { body: [] } },
      ["--dry-run"],
    );
    expect(code).toBe(0);
    expect(writes).toEqual([]);
    expect(out).toContain("criar rótulo autor:doug");
    expect(out).toContain("criar marco 0 · Plataforma");
  });

  it("aplica: POST de rótulos e marcos faltantes", async () => {
    const { code, writes } = await run({
      [`GET ${R}/labels`]: { body: existing },
      [`GET ${R}/milestones`]: { body: [] },
      [`POST ${R}/labels`]: { status: 201, body: {} },
      [`POST ${R}/milestones`]: { status: 201, body: {} },
    });
    expect(code).toBe(0);
    expect(writes.filter((w) => w.path === `${R}/labels`)).toHaveLength(DESIRED_LABELS.length - 1);
    expect(writes.filter((w) => w.path === `${R}/milestones`)).toHaveLength(11);
    expect(writes[0].body).toMatchObject({ name: "autor:gemini" });
  });

  it("422 'já existe' ao criar ⇒ tratado como atualização (PATCH)", async () => {
    const { code, writes } = await run({
      [`GET ${R}/labels`]: { body: existing },
      [`GET ${R}/milestones`]: { body: DESIRED_MILESTONES.map((title) => ({ title })) },
      [`POST ${R}/labels`]: { status: 422, body: { message: "Validation Failed" } },
      [`PATCH ${R}/labels/autor%3Agemini`]: { body: {} },
      [`PATCH ${R}/labels/autor%3Adoug`]: { body: {} },
      [`PATCH ${R}/labels/emergencia`]: { body: {} },
      [`PATCH ${R}/labels/violacao-main`]: { body: {} },
      ...Object.fromEntries(
        Array.from({ length: 11 }, (_, i) => [`PATCH ${R}/labels/iniciativa%3A${i}`, { body: {} }]),
      ),
    });
    expect(code).toBe(0);
    expect(writes.filter((w) => w.method === "PATCH")).toHaveLength(DESIRED_LABELS.length - 1);
  });
});
