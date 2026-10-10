// T012 · contracts/review-gate.md §main-guard (push) — FR-002, FR-004, FR-006, FR-024, FR-026.
import { describe, expect, it } from "vitest";
import { mainGuard } from "../../../src/review/main-guard";
import type { MainGuardInput } from "../../../src/review/types";
import { BASE, CI_JOB_NAMES, greenCheckRuns, makeSnapshot, sha } from "./fixtures";

const MERGE = sha("d");
const input = (over: Partial<MainGuardInput> = {}): MainGuardInput => ({
  commit: { sha: MERGE, parents: [BASE] },
  pr: makeSnapshot({ merged: true, mergedAt: "2026-10-06T15:00:00Z" }),
  requiredChecks: CI_JOB_NAMES,
  checkRuns: greenCheckRuns(),
  ...over,
});

describe("mainGuard (push na main)", () => {
  it("ok: squash de PR integrado, checks verdes e portão recalculado = success", () => {
    expect(mainGuard(input())).toEqual({ ok: true });
  });

  it("commit com 2 pais (não é squash) ⇒ violação", () => {
    const r = mainGuard(input({ commit: { sha: MERGE, parents: [BASE, sha("e")] } }));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reasons[0]).toMatch(/squash/);
  });

  it("commit sem PR integrado ⇒ violação", () => {
    const r = mainGuard(input({ pr: undefined }));
    expect(!r.ok && r.reasons).toEqual(["commit sem PR integrado (push direto?)"]);
  });

  it("check obrigatório ausente ou ≠ success ⇒ violação", () => {
    const missing = mainGuard(input({ checkRuns: greenCheckRuns().slice(1) }));
    expect(!missing.ok && missing.reasons.join()).toContain(CI_JOB_NAMES[0]);
    const failed = greenCheckRuns();
    failed[2] = { ...failed[2], conclusion: "failure" };
    const r = mainGuard(input({ checkRuns: failed }));
    expect(!r.ok && r.reasons.join()).toContain(CI_JOB_NAMES[2]);
  });

  it("check run de outro app não conta", () => {
    const runs = greenCheckRuns().map((c, i) => (i === 0 ? { ...c, appSlug: "outro-app" } : c));
    expect(mainGuard(input({ checkRuns: runs })).ok).toBe(false);
  });

  it("status forjado: sem veredito, evaluateGate recalculado ≠ success ⇒ violação", () => {
    const r = mainGuard(input({ pr: makeSnapshot({ merged: true, reviews: [] }) }));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reasons.join()).toContain("aguardando veredito de Gemini");
  });

  it("PR de autor externo integrado ⇒ violação", () => {
    const r = mainGuard(input({ pr: makeSnapshot({ merged: true, authorLogin: "terceiro" }) }));
    expect(!r.ok && r.reasons.join()).toContain("PR de autor externo — não aceito");
  });

  it("PR emergencia com motivo ⇒ ok e sinaliza a revisão pós-merge pendente", () => {
    const pr = makeSnapshot({
      number: 77,
      merged: true,
      labels: ["autor:claude", "iniciativa:3", "emergencia"],
      body: "Motivo da emergência: produção fora do ar ao abrir o extrato",
      reviews: [],
    });
    expect(mainGuard(input({ pr }))).toEqual({ ok: true, emergencyPr: 77 });
  });
});
