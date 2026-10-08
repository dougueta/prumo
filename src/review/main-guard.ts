// Feature 002 · contracts/review-gate.md §main-guard — auditoria de todo commit na main
// (FR-002, FR-004c, FR-024). Recalcula o portão: o status publicado pode ter sido forjado.
import { labelAgent } from "./authorship";
import { CHECKS_APP_SLUG, EMERGENCY_SLA_DAYS, OVERDUE_PREFIX, REVIEWER_BY_AUTHOR } from "./catalog";
import { collectVerdicts, evaluateGate } from "./evaluate-gate";
import type { CheckRunInfo, MainGuardInput, MainGuardResult, PrSnapshot } from "./types";

/** Verificações obrigatórias sem check run `success` do app GitHub Actions. */
export function failedRequiredChecks(required: string[], runs: CheckRunInfo[]): string[] {
  return required.filter(
    (name) =>
      !runs.some(
        (r) => r.name === name && r.appSlug === CHECKS_APP_SLUG && r.conclusion === "success",
      ),
  );
}

export function mainGuard(input: MainGuardInput): MainGuardResult {
  const reasons: string[] = [];
  if (input.commit.parents.length !== 1) {
    reasons.push(`commit não é squash (${input.commit.parents.length} pais)`);
  }
  if (!input.pr) {
    reasons.push("commit sem PR integrado (push direto?)");
    return { ok: false, reasons };
  }
  for (const name of failedRequiredChecks(input.requiredChecks, input.checkRuns)) {
    reasons.push(`verificação obrigatória ausente ou não aprovada: ${name}`);
  }
  const gate = evaluateGate(input.pr);
  if (gate.state !== "success") {
    reasons.push(`revisão independente não confirmada: ${gate.reason}`);
  }
  if (reasons.length) return { ok: false, reasons };
  return gate.emergency ? { ok: true, emergencyPr: input.pr.number } : { ok: true };
}

export type EmergencyAction = { action: "close" } | { action: "overdue" } | { action: "none" };

/**
 * Modo agendado (FR-024): a emergência é regularizada por um veredito válido do revisor
 * designado publicado depois do merge; sem ele, após EMERGENCY_SLA_DAYS a issue vira VENCIDA.
 */
export function emergencyAction(input: {
  issue: { title: string };
  pr: PrSnapshot;
  now: Date;
}): EmergencyAction {
  const mergedAt = input.pr.mergedAt;
  if (!mergedAt) return { action: "none" };
  const designated = REVIEWER_BY_AUTHOR[labelAgent(input.pr.labels) ?? "doug"];
  const after = collectVerdicts(input.pr, designated).filter((v) => v.publishedAt > mergedAt);
  if (after.length) return { action: "close" };
  const elapsed = input.now.getTime() - new Date(mergedAt).getTime();
  if (elapsed > EMERGENCY_SLA_DAYS * 86_400_000 && !input.issue.title.startsWith(OVERDUE_PREFIX)) {
    return { action: "overdue" };
  }
  return { action: "none" };
}
