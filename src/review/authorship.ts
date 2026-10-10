// Feature 002 · research R-06 — autoria do PR (FR-011, FR-026).
import { AUTHOR_LABELS, OWNER_LOGIN, REPO_FULL_NAME } from "./catalog";
import type { Agent, Reviewer } from "./types";

const TRAILER = /^co-authored-by:.*\b(claude|gemini)\b/i;

/** Agentes declarados nas linhas `Co-Authored-By:` de uma mensagem de commit. */
export function agentsFromTrailers(message: string): Set<Reviewer> {
  const out = new Set<Reviewer>();
  for (const line of message.split(/\r?\n/)) {
    const m = TRAILER.exec(line.trim());
    if (m) out.add(m[1].toLowerCase() as Reviewer);
  }
  return out;
}

/** Agente autor pelos commits: único agente dos trailers, "doug" se nenhum, falha se misto. */
export function commitAgent(
  commits: { message: string }[],
): { ok: true; agent: Agent } | { ok: false } {
  const all = new Set<Reviewer>();
  for (const c of commits) for (const a of agentsFromTrailers(c.message)) all.add(a);
  if (all.size > 1) return { ok: false };
  return { ok: true, agent: all.size === 1 ? [...all][0] : "doug" };
}

/** Agente do rótulo `autor:*`, ou null se houver 0 ou mais de 1 rótulo de autor. */
export function labelAgent(labels: string[]): Agent | null {
  const found = labels.filter((l) => (AUTHOR_LABELS as readonly string[]).includes(l));
  if (found.length !== 1) return null;
  return found[0].slice("autor:".length) as Agent;
}

/** PR de autor externo ou de fork (FR-026). */
export function isExternal(pr: { authorLogin: string; headRepoFullName: string | null }): boolean {
  return pr.authorLogin !== OWNER_LOGIN || pr.headRepoFullName !== REPO_FULL_NAME;
}
