// T014 · contracts/review-cli.md §pr:merge — mergeReadiness (FR-002, FR-003, FR-004).
import { describe, expect, it } from "vitest";
import { mergeReadiness } from "../../../src/review/merge-readiness";
import type { GateResult, MergeReadinessInput } from "../../../src/review/types";
import { CI_JOB_NAMES, greenCheckRuns } from "./fixtures";

const gate = (over: Partial<GateResult> = {}): GateResult => ({
  state: "success",
  reason: "APROVADO por Gemini em aaaaaaa",
  warnings: [],
  kind: "feature",
  designatedReviewer: "gemini",
  touchesGate: false,
  emergency: false,
  ...over,
});
const input = (over: Partial<MergeReadinessInput> = {}): MergeReadinessInput => ({
  gate: gate(),
  requiredChecks: CI_JOB_NAMES,
  checkRuns: greenCheckRuns(),
  behindBy: 0,
  isTty: true,
  gateSelfConfirmed: false,
  emergencyConfirmed: false,
  ...over,
});

describe("mergeReadiness", () => {
  it("pronto ⇒ exit 0", () => {
    expect(mergeReadiness(input())).toEqual({ exit: 0, messages: [] });
  });

  it("fora de TTY ⇒ exit 8 (antes de qualquer outra regra)", () => {
    const r = mergeReadiness(
      input({ isTty: false, behindBy: 3, gate: gate({ state: "pending" }) }),
    );
    expect(r).toEqual({ exit: 8, messages: ["merge exige o Doug no terminal"] });
  });

  it("check obrigatório ausente, ≠ success ou de outro app ⇒ exit 6 listando o que falta", () => {
    const runs = greenCheckRuns();
    runs[0] = { ...runs[0], conclusion: "failure" };
    runs[1] = { ...runs[1], appSlug: "outro-app" };
    const r = mergeReadiness(input({ checkRuns: runs.slice(0, 3) }));
    expect(r.exit).toBe(6);
    expect(r.messages).toEqual([
      `verificação não aprovada: ${CI_JOB_NAMES[0]}`,
      `verificação não aprovada: ${CI_JOB_NAMES[1]}`,
      `verificação não aprovada: ${CI_JOB_NAMES[3]}`,
    ]);
  });

  it("evaluateGate recalculado ≠ success ⇒ exit 6 com o motivo (status forjado)", () => {
    const r = mergeReadiness(
      input({ gate: gate({ state: "pending", reason: "aguardando veredito de Gemini" }) }),
    );
    expect(r).toEqual({
      exit: 6,
      messages: ["Revisão independente: aguardando veredito de Gemini"],
    });
  });

  it("branch atrás da main ⇒ exit 7", () => {
    expect(mergeReadiness(input({ behindBy: 1 }))).toEqual({
      exit: 7,
      messages: ["faça rebase na main e aguarde o CI"],
    });
  });

  it("touchesGate sem 'revisei' ⇒ exit 9; com a confirmação ⇒ 0", () => {
    expect(mergeReadiness(input({ gate: gate({ touchesGate: true }) }))).toEqual({
      exit: 9,
      messages: ["revisão manual dos arquivos do portão não confirmada"],
    });
    expect(
      mergeReadiness(input({ gate: gate({ touchesGate: true }), gateSelfConfirmed: true })).exit,
    ).toBe(0);
  });

  it("emergência sem 'emergencia' ⇒ exit 9; com a confirmação ⇒ 0", () => {
    const g = gate({
      emergency: true,
      reason: "EMERGÊNCIA — revisão independente pós-merge em até 7 dias",
    });
    expect(mergeReadiness(input({ gate: g })).exit).toBe(9);
    expect(mergeReadiness(input({ gate: g, emergencyConfirmed: true })).exit).toBe(0);
  });
});
