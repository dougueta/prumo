// Feature 002 · research R-06 — tipo do PR, spec esperada e mecanismos de revisão.
import { CONSTITUTION_PATH, FEATURE_BRANCH, GATE_SELF_PATHS, PROCESS_PATHS } from "./catalog";
import type { PrKind } from "./types";

/** `dir/**` casa tudo abaixo de `dir/`; qualquer outro padrão é caminho exato. */
export function matchesPath(pattern: string, file: string): boolean {
  if (pattern.endsWith("/**")) return file.startsWith(pattern.slice(0, -2));
  return file === pattern;
}

const matchesAny = (patterns: readonly string[], file: string) =>
  patterns.some((p) => matchesPath(p, file));

/** emenda ⊃ processo ⊃ feature. */
export function classifyPr(files: string[]): PrKind {
  if (files.includes(CONSTITUTION_PATH)) return "emenda";
  if (files.every((f) => matchesAny(PROCESS_PATHS, f))) return "processo";
  return "feature";
}

/** O PR altera o portão, os revisores ou o checklist (trava do FR-024). */
export function touchesGate(files: string[]): boolean {
  return files.some((f) => matchesAny(GATE_SELF_PATHS, f));
}

export function isFeatureBranch(ref: string): boolean {
  return FEATURE_BRANCH.test(ref);
}
