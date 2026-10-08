// Feature 002 · contracts/veredito.md §3 — comentário único de avisos do portão (FR-010).
import { STATUS_CONTEXT, WARNINGS_MARKER } from "./catalog";

/** Corpo do comentário `prumo:avisos` (só textos do catálogo e o sha do head). */
export function renderWarningsComment(headSha: string, warnings: string[]): string {
  return [
    WARNINGS_MARKER,
    `**Avisos da verificação "${STATUS_CONTEXT}"** (head \`${headSha.slice(0, 7)}\`)`,
    ...warnings.map((w) => `- ${w}`),
  ].join("\n");
}
