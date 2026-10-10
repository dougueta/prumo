// Feature 002 · contracts/review-gate.md — tabela de decisão da verificação "Revisão independente".
// Pura: nenhuma rede, ordenação estável; motivos e avisos só com textos do catálogo, números e shas.
import { commitAgent, isExternal, labelAgent } from "./authorship";
import {
  EMERGENCY_LABEL,
  FORMAT_ERRORS,
  INITIATIVE_LABEL,
  OWNER_LOGIN,
  REASONS,
  REASON_MAX_LENGTH,
  RESPONSE_MARKER,
  REVIEWER_BY_AUTHOR,
  REVIEWER_IDENTITY,
  SEVERITIES,
  VERDICT_MARKER,
  WARNINGS,
  WARNINGS_MARKER,
  publisherDisplay,
} from "./catalog";
import { classifyPr, isFeatureBranch, touchesGate as touchesGateFiles } from "./classify-pr";
import { answeredFindings, parseResponses } from "./parse-responses";
import { inlineSeverity, parseVerdict } from "./parse-verdict";
import type {
  GateResult,
  GateState,
  PrKind,
  PrSnapshot,
  RawUser,
  Reviewer,
  Severity,
  Verdict,
} from "./types";

const EMERGENCY_REASON = /Motivo da emergência:\s*(\S.{19,})/;
const STRONG: Severity[] = ["CRÍTICO", "ALTO"];

function identityOf(user: RawUser | null): Reviewer | null {
  if (!user || user.type !== "Bot") return null;
  for (const r of Object.keys(REVIEWER_IDENTITY) as Reviewer[]) {
    if (REVIEWER_IDENTITY[r].login === user.login) return r;
  }
  return null;
}

/** APROVADO com achado CRÍTICO/ALTO (tabela ou selo inline) é tratado como MUDANÇAS. */
export function isIncoherent(v: Verdict): boolean {
  if (v.outcome !== "APROVADO") return false;
  const sev = [...v.findings.map((f) => f.severity), ...(v.inlineSeverities ?? [])];
  return sev.some((s) => STRONG.includes(s));
}

export const effectiveOutcome = (v: Verdict) =>
  isIncoherent(v) ? "MUDANÇAS NECESSÁRIAS" : v.outcome;

interface Candidate {
  user: RawUser | null;
  body: string;
  source: "review" | "comment";
  id: number;
  at: string;
  commitId?: string;
}

/**
 * Vereditos válidos do revisor designado, em ordem de publicação, já aplicada a regra de
 * contexto da re-revisão (FR-020). Avisos vão para `warnings`.
 */
export function collectVerdicts(
  s: PrSnapshot,
  designated: Reviewer,
  warnings: string[] = [],
): Verdict[] {
  const candidates: Candidate[] = [
    ...s.reviews.map((r) => ({
      user: r.user,
      body: r.body ?? "",
      source: "review" as const,
      id: r.id,
      at: r.submitted_at,
      commitId: r.commit_id,
    })),
    ...s.issueComments
      .filter((c) => !(c.body ?? "").includes(WARNINGS_MARKER))
      .map((c) => ({
        user: c.user,
        body: c.body ?? "",
        source: "comment" as const,
        id: c.id,
        at: c.created_at,
      })),
  ].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.id - b.id));

  const valid: Verdict[] = [];
  for (const c of candidates) {
    if (!c.body.includes(VERDICT_MARKER)) continue;
    const who = identityOf(c.user);
    if (who !== designated) {
      warnings.push(WARNINGS.notDesignated(publisherDisplay(who, c.user?.login === OWNER_LOGIN)));
      continue;
    }
    if (who === "gemini" && c.source !== "review") {
      warnings.push(WARNINGS.badFormat(FORMAT_ERRORS.geminiComment));
      continue;
    }
    const parsed = parseVerdict(c.body, who);
    if (parsed.status === "absent") continue;
    if (parsed.status === "invalid") {
      warnings.push(WARNINGS.badFormat(parsed.error));
      continue;
    }
    const v: Verdict = {
      ...parsed.verdict,
      reviewer: who,
      source: c.source,
      sourceId: c.id,
      headSha: who === "gemini" ? (c.commitId ?? "") : (parsed.verdict.markerHead ?? ""),
      publishedAt: c.at,
    };
    if (who === "gemini" && c.source === "review") {
      v.inlineSeverities = s.reviewComments
        .filter((rc) => rc.pull_request_review_id === c.id)
        .map((rc) => inlineSeverity(rc.body))
        .filter((x): x is Severity => x !== null);
    }
    const prev = valid.at(-1);
    if (prev && effectiveOutcome(prev) === "MUDANÇAS NECESSÁRIAS") {
      const covered = new Set(v.previous.map((p) => p.n));
      if (!prev.findings.every((f) => covered.has(f.n))) {
        warnings.push(WARNINGS.badFormat(FORMAT_ERRORS.previousIncomplete));
        continue;
      }
    }
    valid.push(v);
  }
  return valid;
}

function amendmentVersioned(patch: string | undefined): boolean {
  if (!patch) return false;
  const changed = patch.split("\n").filter((l) => /^[+-]/.test(l) && !/^(\+\+\+|---) /.test(l));
  return (
    changed.some((l) => l.includes("**Version**:")) &&
    changed.some((l) => l.includes("Version change:"))
  );
}

function countBySeverity(sev: Severity[]): string {
  return SEVERITIES.map((s) => [s, sev.filter((x) => x === s).length] as const)
    .filter(([, n]) => n > 0)
    .map(([s, n]) => `${n} ${s}`)
    .join(", ");
}

const truncate = (s: string) =>
  s.length <= REASON_MAX_LENGTH ? s : `${s.slice(0, REASON_MAX_LENGTH - 1)}…`;

export function evaluateGate(s: PrSnapshot): GateResult {
  const warnings: string[] = [];
  const kind: PrKind = classifyPr(s.changedFiles);
  const touchesGate = touchesGateFiles(s.changedFiles);
  let designatedReviewer: Reviewer | undefined = undefined;
  let emergency = false;
  const done = (state: GateState, reason: string): GateResult => {
    if (touchesGate) warnings.push(WARNINGS.touchesGate);
    return {
      state,
      reason: truncate(reason),
      warnings: [...new Set(warnings)],
      kind,
      designatedReviewer,
      touchesGate,
      emergency,
    };
  };

  // 0 · autor externo ou fork (FR-026)
  if (isExternal(s)) return done("failure", REASONS.external);
  // 1 · rascunho
  if (s.draft) return done("pending", REASONS.draft);
  // 2 · rótulo de autor
  const labelAg = labelAgent(s.labels);
  if (!labelAg) return done("failure", REASONS.authorLabel);
  // 3–4 · trailers de autoria
  const byCommits = commitAgent(s.commits);
  if (!byCommits.ok) return done("failure", REASONS.mixedAgents);
  if (byCommits.agent !== labelAg) return done("failure", REASONS.labelMismatch);
  designatedReviewer = REVIEWER_BY_AUTHOR[labelAg];
  // 5–6 · feature: iniciativa e spec
  if (kind === "feature") {
    if (!s.labels.some((l) => INITIATIVE_LABEL.test(l))) return done("failure", REASONS.initiative);
    if (!isFeatureBranch(s.headRef) || !s.specExists) return done("failure", REASONS.noSpec);
  }
  // 7 · emenda
  if (kind === "emenda" && !amendmentVersioned(s.constitutionPatch)) {
    return done("failure", REASONS.amendment);
  }
  // 8–9 · emergência (FR-024, com a trava)
  if (s.labels.includes(EMERGENCY_LABEL)) {
    if (kind === "emenda" || touchesGate) return done("failure", REASONS.emergencyLocked);
    if (!EMERGENCY_REASON.test(s.body)) return done("failure", REASONS.emergencyNoReason);
    emergency = true;
    return done("success", REASONS.emergency);
  }

  // 10–14 · veredito do revisor designado
  const valid = collectVerdicts(s, designatedReviewer, warnings);
  const last = valid.at(-1);
  if (!last) return done("pending", REASONS.awaiting(designatedReviewer));

  let neutral = false;
  if (last.headSha !== s.headSha) {
    const a = s.fingerprints[last.headSha];
    const b = s.fingerprints[s.headSha];
    if (!a || !b || a !== b) return done("pending", REASONS.stale);
    neutral = true;
  }

  if (isIncoherent(last)) warnings.push(WARNINGS.incoherent);
  if (effectiveOutcome(last) === "MUDANÇAS NECESSÁRIAS") {
    const sev = last.findings.length
      ? last.findings.map((f) => f.severity)
      : (last.inlineSeverities ?? []);
    return done("failure", REASONS.changes(sev.length, countBySeverity(sev)));
  }

  const prev = valid
    .slice(0, -1)
    .reverse()
    .find((v) => effectiveOutcome(v) === "MUDANÇAS NECESSÁRIAS");
  if (prev) {
    const responses = s.issueComments
      .filter((c) => (c.body ?? "").includes(RESPONSE_MARKER) && c.created_at > prev.publishedAt)
      .map(parseResponses)
      .filter((r) => r !== null);
    const answered = answeredFindings(
      responses,
      s.commits.map((c) => c.sha),
    );
    const missing = prev.findings
      .map((f) => f.n)
      .filter((n) => !answered.has(n))
      .sort((x, y) => x - y);
    if (missing.length) return done("failure", REASONS.unanswered(missing));
  }

  return done("success", REASONS.approved(designatedReviewer, last.headSha.slice(0, 7), neutral));
}
