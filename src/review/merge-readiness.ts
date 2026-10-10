// Feature 002 · contracts/review-cli.md §pr:merge — decisão do comando de merge do Doug
// (FR-002, FR-003, FR-004). Usa o portão RECALCULADO, nunca o status publicado.
import { STATUS_CONTEXT } from "./catalog";
import { failedRequiredChecks } from "./main-guard";
import type { MergeReadinessInput } from "./types";

export type MergeExit = 0 | 6 | 7 | 8 | 9;
export interface MergeReadiness {
  exit: MergeExit;
  messages: string[];
}

export const MERGE_MESSAGES = {
  noTty: "merge exige o Doug no terminal",
  check: (name: string) => `verificação não aprovada: ${name}`,
  gate: (reason: string) => `${STATUS_CONTEXT}: ${reason}`,
  behind: "faça rebase na main e aguarde o CI",
  gateSelf: "revisão manual dos arquivos do portão não confirmada",
  emergency: "emergência não confirmada pelo Doug",
  dougNoTrailers:
    "PR autor:doug sem nenhum trailer de agente — confirme que foi você quem escreveu (um agente sem trailer escolheria o próprio revisor)",
} as const;

export function mergeReadiness(i: MergeReadinessInput): MergeReadiness {
  if (!i.isTty) return { exit: 8, messages: [MERGE_MESSAGES.noTty] };
  const blocking = [
    ...failedRequiredChecks(i.requiredChecks, i.checkRuns).map(MERGE_MESSAGES.check),
    ...(i.gate.state === "success" ? [] : [MERGE_MESSAGES.gate(i.gate.reason)]),
  ];
  if (blocking.length) return { exit: 6, messages: blocking };
  if (i.behindBy > 0) return { exit: 7, messages: [MERGE_MESSAGES.behind] };
  if (i.gate.touchesGate && !i.gateSelfConfirmed) {
    return { exit: 9, messages: [MERGE_MESSAGES.gateSelf] };
  }
  if (i.gate.emergency && !i.emergencyConfirmed) {
    return { exit: 9, messages: [MERGE_MESSAGES.emergency] };
  }
  return { exit: 0, messages: [] };
}
