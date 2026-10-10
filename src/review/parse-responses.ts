// Feature 002 · contracts/veredito.md §2 — resposta do autor aos achados (FR-019).
import { OWNER_LOGIN, RESPONSE_MARKER } from "./catalog";
import type { AuthorResponse, AuthorResponseLine, RawIssueComment } from "./types";

const SHA = /^[0-9a-f]{7,40}$/;
const MIN_JUSTIFICATION = 20;

/**
 * Lê um comentário `prumo:respostas`. Só vale comentário da conta do Doug (usada pelos autores);
 * linhas inválidas são descartadas. Retorna null se não houver marcador ou o autor não valer.
 */
export function parseResponses(comment: RawIssueComment): AuthorResponse | null {
  const body = (comment.body ?? "").replace(/\r\n/g, "\n");
  if (!body.includes(RESPONSE_MARKER)) return null;
  if (comment.user?.login !== OWNER_LOGIN) return null;
  const lines: AuthorResponseLine[] = [];
  for (const raw of body.slice(body.indexOf(RESPONSE_MARKER)).split("\n")) {
    if (!raw.trim().startsWith("|")) continue;
    const cells = raw
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim());
    if (cells.length < 3 || !/^\d+$/.test(cells[0])) continue;
    const n = Number(cells[0]);
    const action = cells[1].toLowerCase();
    const ref = cells.slice(2).join("|").trim().replace(/^`|`$/g, "");
    if (action === "corrigido" && SHA.test(ref)) lines.push({ n, action, ref });
    else if (action === "justificado" && ref.length >= MIN_JUSTIFICATION)
      lines.push({ n, action, ref });
  }
  return { lines, publishedAt: comment.created_at, authorLogin: OWNER_LOGIN };
}

/** União dos # respondidos; `corrigido` só conta se o sha (prefixo) está nos commits do PR. */
export function answeredFindings(responses: AuthorResponse[], commitShas: string[]): Set<number> {
  const out = new Set<number>();
  for (const r of responses) {
    for (const l of r.lines) {
      if (l.action === "justificado" || commitShas.some((s) => s.startsWith(l.ref))) out.add(l.n);
    }
  }
  return out;
}
