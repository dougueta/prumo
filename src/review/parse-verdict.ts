// Feature 002 · contracts/veredito.md §1 — parser do bloco de veredito (sem contexto).
import { FORMAT_ERRORS, VERDICT_MARKER, WARNINGS_MARKER } from "./catalog";
import type {
  Coverage,
  Finding,
  Outcome,
  ParsedVerdict,
  PreviousFinding,
  PreviousStatus,
  Reviewer,
  Severity,
} from "./types";

export type ParseVerdictResult =
  | { status: "absent" }
  | { status: "invalid"; error: string }
  | { status: "ok"; verdict: ParsedVerdict };

class FormatError extends Error {}

/** Remove acentos e padroniza caixa para comparar rótulos escritos à mão. */
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toUpperCase();

const SEVERITY_BY_FOLD: Record<string, Severity> = {
  CRITICO: "CRÍTICO",
  ALTO: "ALTO",
  MEDIO: "MÉDIO",
  BAIXO: "BAIXO",
};
const OUTCOME_BY_FOLD: Record<string, Outcome> = {
  APROVADO: "APROVADO",
  "MUDANCAS NECESSARIAS": "MUDANÇAS NECESSÁRIAS",
};
const PREVIOUS_BY_FOLD: Record<string, PreviousStatus> = {
  RESOLVIDO: "resolvido",
  "JUSTIFICATIVA ACEITA": "justificativa aceita",
  PERMANECE: "permanece",
};
const SEAL_SEVERITY: Record<string, Severity> = {
  critical: "CRÍTICO",
  high: "ALTO",
  medium: "MÉDIO",
  low: "BAIXO",
};

/** Divide o texto em seções "### Título" → linhas. */
function sections(lines: string[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  let current: string[] | null = null;
  for (const line of lines) {
    const h = /^#{2,3}\s+(.+?)\s*$/.exec(line);
    if (h && line.startsWith("### ")) {
      current = [];
      out.set(fold(h[1]), current);
    } else if (h) {
      current = null; // "## …" encerra a seção anterior
    } else if (current) {
      current.push(line);
    }
  }
  return out;
}

/** Linhas de dados da primeira tabela da seção (ignora cabeçalho, separador e linha vazia "—"). */
function tableRows(body: string[] | undefined, columns: number): string[][] | null {
  if (!body) return null;
  const start = body.findIndex((l) => l.trim().startsWith("|"));
  if (start < 0) return null;
  const rows: string[][] = [];
  for (let i = start; i < body.length && body[i].trim().startsWith("|"); i++) {
    const cells = body[i]
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim());
    rows.push(cells);
  }
  if (rows.length < 2 || !rows[1].every((c) => /^:?-{3,}:?$/.test(c))) return null;
  if (rows[0].length !== columns) throw new FormatError(FORMAT_ERRORS.columns);
  return rows.slice(2).filter((r) => !r.every((c) => c === "" || /^[—–-]+$/.test(c)));
}

function parseNumber(cell: string, seen: Set<number>): number {
  if (!/^\d+$/.test(cell)) throw new FormatError(FORMAT_ERRORS.number);
  const n = Number(cell);
  if (n < 1 || seen.has(n)) throw new FormatError(FORMAT_ERRORS.number);
  seen.add(n);
  return n;
}

function parseFindings(rows: string[][]): Finding[] {
  const seen = new Set<number>();
  return rows.map((r) => {
    if (r.length !== 6) throw new FormatError(FORMAT_ERRORS.columns);
    const n = parseNumber(r[0], seen);
    const severity = SEVERITY_BY_FOLD[fold(r[1].replace(/\*/g, ""))];
    if (!severity) throw new FormatError(FORMAT_ERRORS.severity);
    return { n, severity, location: r[2], principle: r[3], problem: r[4], suggestion: r[5] };
  });
}

function parsePrevious(rows: string[][]): PreviousFinding[] {
  const seen = new Set<number>();
  return rows.map((r) => {
    if (r.length !== 2) throw new FormatError(FORMAT_ERRORS.columns);
    const n = parseNumber(r[0].replace(/^#/, ""), seen);
    const status = PREVIOUS_BY_FOLD[fold(r[1])];
    if (!status) throw new FormatError(FORMAT_ERRORS.previousStatus);
    return { n, status };
  });
}

function parseCoverage(rows: string[][]): Coverage[] {
  return rows.map((r) => {
    if (r.length !== 4) throw new FormatError(FORMAT_ERRORS.columns);
    const mark = r[3];
    let ok: boolean;
    if (/^(✅|✔️?)$/.test(mark) || ["SIM", "OK"].includes(fold(mark))) ok = true;
    else if (/^(❌|✖️?)$/.test(mark) || fold(mark) === "NAO") ok = false;
    else throw new FormatError(FORMAT_ERRORS.coverageOk);
    return { fr: r[0], implementedIn: r[1], testedIn: r[2], ok };
  });
}

function parseInputs(body: string[] | undefined): string[] | undefined {
  if (!body) return undefined;
  const items = body
    .map((l) => /^\s*[-*]\s+(.+?)\s*$/.exec(l)?.[1])
    .filter((s): s is string => Boolean(s))
    .map((s) => s.replace(/\s*\(.*\)\s*$/, "").replace(/^`|`$/g, ""));
  return items.length ? items : undefined;
}

export function parseVerdict(body: string, reviewer: Reviewer): ParseVerdictResult {
  if (body.includes(WARNINGS_MARKER)) return { status: "absent" };
  const at = body.indexOf(VERDICT_MARKER);
  if (at < 0) return { status: "absent" };
  try {
    const text = body.slice(at).replace(/\r\n/g, "\n");
    const marker = /^<!-- prumo:veredito v1(?:\s+head=(\S+))?\s*-->/.exec(text);
    const markerHead = marker?.[1];
    if (reviewer === "claude" && (!markerHead || !/^[0-9a-f]{40}$/.test(markerHead))) {
      throw new FormatError(FORMAT_ERRORS.head);
    }
    const lines = text.split("\n");
    const header = lines
      .map((l) => /^##\s+Veredito:\s*(.+?)\s*$/.exec(l)?.[1])
      .find((s) => s !== undefined);
    const outcome = header ? OUTCOME_BY_FOLD[fold(header.replace(/\*/g, ""))] : undefined;
    if (!outcome) throw new FormatError(FORMAT_ERRORS.header);

    const secs = sections(lines);
    const findingRows = tableRows(secs.get("ACHADOS"), 6);
    if (!findingRows) throw new FormatError(FORMAT_ERRORS.findings);
    const coverageRows = tableRows(secs.get("COBERTURA DE REQUISITOS"), 4);
    if (!coverageRows) throw new FormatError(FORMAT_ERRORS.coverage);
    const previousRows = tableRows(secs.get("ACHADOS ANTERIORES"), 2) ?? [];

    const verdict: ParsedVerdict = {
      outcome,
      findings: parseFindings(findingRows),
      previous: parsePrevious(previousRows),
      coverage: parseCoverage(coverageRows),
    };
    const inputsRead = parseInputs(secs.get("INSUMOS LIDOS"));
    if (inputsRead) verdict.inputsRead = inputsRead;
    if (markerHead && /^[0-9a-f]{40}$/.test(markerHead)) verdict.markerHead = markerHead;
    if (reviewer === "claude" && !inputsRead) throw new FormatError(FORMAT_ERRORS.inputs);
    return { status: "ok", verdict };
  } catch (e) {
    if (e instanceof FormatError) return { status: "invalid", error: e.message };
    throw e;
  }
}

/** Selo de severidade de um comentário de linha do Gemini (`codereviewagent/<sev>-priority.svg`). */
export function inlineSeverity(body: string): Severity | null {
  const m = /codereviewagent\/(critical|high|medium|low)-priority\.svg/.exec(body);
  return m ? SEAL_SEVERITY[m[1]] : null;
}
