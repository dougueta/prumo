// Feature 002 · data-model §2 — tipos canônicos do revisor de PR independente.
// Lógica pura: nada aqui faz IO nem lê process.env.

export type Agent = "claude" | "gemini" | "doug";
/** O Doug nunca é revisor. */
export type Reviewer = Exclude<Agent, "doug">;
export type Severity = "CRÍTICO" | "ALTO" | "MÉDIO" | "BAIXO";
export type Outcome = "APROVADO" | "MUDANÇAS NECESSÁRIAS";
export type PrKind = "feature" | "processo" | "emenda";

export interface Finding {
  n: number;
  severity: Severity;
  location: string;
  principle: string;
  problem: string;
  suggestion: string;
}

export type PreviousStatus = "resolvido" | "justificativa aceita" | "permanece";
export interface PreviousFinding {
  n: number;
  status: PreviousStatus;
}

export interface Coverage {
  fr: string;
  implementedIn: string;
  testedIn: string;
  ok: boolean;
}

/** Resultado do parser, sem o contexto de onde o texto foi publicado. */
export interface ParsedVerdict {
  outcome: Outcome;
  findings: Finding[];
  previous: PreviousFinding[];
  coverage: Coverage[];
  inputsRead?: string[];
  /** sha do marcador `head=` (obrigatório para o Claude). */
  markerHead?: string;
}

export interface Verdict extends ParsedVerdict {
  reviewer: Reviewer;
  source: "review" | "comment";
  sourceId: number;
  headSha: string;
  publishedAt: string;
  inlineSeverities?: Severity[];
}

export type ResponseAction = "corrigido" | "justificado";
export interface AuthorResponseLine {
  n: number;
  action: ResponseAction;
  ref: string;
}
export interface AuthorResponse {
  lines: AuthorResponseLine[];
  publishedAt: string;
  authorLogin: string;
}

// Formas cruas da API do GitHub (contracts/github-api.openapi.yaml) — só os campos lidos.
export interface RawUser {
  login: string;
  type: string;
}
export interface RawReview {
  id: number;
  user: RawUser | null;
  body: string | null;
  commit_id: string;
  submitted_at: string;
  state?: string;
}
export interface RawReviewComment {
  id: number;
  pull_request_review_id: number | null;
  body: string;
  user: RawUser | null;
}
export interface RawIssueComment {
  id: number;
  user: RawUser | null;
  body: string | null;
  created_at: string;
  updated_at?: string;
}

export interface PrSnapshot {
  number: number;
  draft: boolean;
  merged: boolean;
  mergedAt?: string;
  /** pull.user.login — ≠ OWNER_LOGIN ⇒ externo (FR-026). */
  authorLogin: string;
  /** pull.head.repo.full_name — null quando o fork foi apagado (tratado como fork). */
  headRepoFullName: string | null;
  headSha: string;
  headRef: string;
  baseRef: string;
  body: string;
  labels: string[];
  changedFiles: string[];
  constitutionPatch?: string;
  commits: { sha: string; message: string }[];
  specExists: boolean;
  /** sha → impressão do conteúdo do PR (data-model §2.1). */
  fingerprints: Record<string, string | null>;
  reviews: RawReview[];
  reviewComments: RawReviewComment[];
  issueComments: RawIssueComment[];
}

export type GateState = "success" | "pending" | "failure";
export interface GateResult {
  state: GateState;
  /** ≤ 140 caracteres, pt-BR, só textos do catálogo, números e shas. */
  reason: string;
  warnings: string[];
  kind: PrKind;
  designatedReviewer?: Reviewer;
  touchesGate: boolean;
  emergency: boolean;
}

export interface CheckRunInfo {
  name: string;
  conclusion: string | null;
  appSlug: string;
}

export interface MainGuardInput {
  commit: { sha: string; parents: string[] };
  pr?: PrSnapshot;
  requiredChecks: string[];
  checkRuns: CheckRunInfo[];
}
export type MainGuardResult = { ok: true; emergencyPr?: number } | { ok: false; reasons: string[] };

export interface MergeReadinessInput {
  gate: GateResult;
  requiredChecks: string[];
  checkRuns: CheckRunInfo[];
  behindBy: number;
  isTty: boolean;
  gateSelfConfirmed: boolean;
  emergencyConfirmed: boolean;
}

/** Arquivo de `GET /compare/{base}...{head}` (impressão de conteúdo). */
export interface CompareFile {
  filename: string;
  status: string;
  previous_filename?: string;
  patch?: string;
}
