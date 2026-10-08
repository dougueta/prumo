// Feature 002 · data-model §1 — catálogos fixos do revisor de PR independente.
// Todas as mensagens publicadas pelo portão saem daqui (nunca de texto vindo do PR — FR-026).
import type { Agent, Reviewer, Severity } from "./types";

export const STATUS_CONTEXT = "Revisão independente";
export const CI_WORKFLOW_PATH = ".github/workflows/ci.yml";

export const AUTHOR_LABELS = ["autor:claude", "autor:gemini", "autor:doug"] as const;
export type AuthorLabel = (typeof AUTHOR_LABELS)[number];

export const REVIEWER_BY_AUTHOR: Record<Agent, Reviewer> = {
  claude: "gemini",
  doug: "gemini",
  gemini: "claude",
};

export const REVIEWER_IDENTITY: Record<Reviewer, { login: string; type: "Bot" }> = {
  gemini: { login: "gemini-code-assist[bot]", type: "Bot" },
  claude: { login: "prumo-revisor[bot]", type: "Bot" },
};

export const REVIEWER_DISPLAY: Record<Reviewer, string> = {
  gemini: "Gemini",
  claude: "Claude (prumo-revisor)",
};

export const CHECKS_APP_SLUG = "github-actions";
/** Login do bot que publica o comentário de avisos (GITHUB_TOKEN do Actions). */
export const ACTIONS_BOT_LOGIN = "github-actions[bot]";
export const INITIATIVE_LABEL = /^iniciativa:(?:[0-9]|10)$/;
export const EMERGENCY_LABEL = "emergencia";
export const VIOLATION_LABEL = "violacao-main";

/** Áreas de processo: dispensadas de spec (Constitution I), não de revisão. */
export const PROCESS_PATHS = [
  "docs/**",
  "AGENTS.md",
  "CLAUDE.md",
  "GEMINI.md",
  "README.md",
  ".specify/**",
  ".gemini/**",
  ".claude/**",
  ".github/pull_request_template.md",
] as const;

/** "Mecanismos de revisão" (trava do FR-024; aviso de revisão manual do Doug). */
export const GATE_SELF_PATHS = [
  ".github/workflows/**",
  "scripts/review/**",
  "src/review/**",
  "tests/unit/review/**",
  ".gemini/**",
  ".claude/settings.json",
  ".claude/agents/revisor-limpo.md",
  ".claude/skills/revisar-pr/**",
  "docs/review-checklist.md",
] as const;

export const OWNER_LOGIN = "dougueta";
export const REPO_FULL_NAME = "dougueta/prumo";
export const REPO_NAME = "prumo";
/** App GitHub Actions — fixado no ruleset para as verificações obrigatórias. */
export const ACTIONS_INTEGRATION_ID = 15368;
export const MIRROR_PATH = "tests/unit/review/__snapshots__/workflows.md";
export const CONSTITUTION_PATH = ".specify/memory/constitution.md";
export const EMERGENCY_SLA_DAYS = 7;
export const VERDICT_MARKER = "<!-- prumo:veredito v1";
export const RESPONSE_MARKER = "<!-- prumo:respostas v1 -->";
export const WARNINGS_MARKER = "<!-- prumo:avisos v1 -->";
export const FINGERPRINT_MAX_FILES = 300;
export const FEATURE_BRANCH = /^\d{3}-[a-z0-9-]+$/;
export const REASON_MAX_LENGTH = 140;
export const RULESET_NAME = "main protegida";
export const EMERGENCY_ISSUE_PREFIX = "Revisão pós-merge pendente: #";
export const OVERDUE_PREFIX = "VENCIDA — ";

export const SEVERITIES: readonly Severity[] = ["CRÍTICO", "ALTO", "MÉDIO", "BAIXO"];

const display = (r: Reviewer) => REVIEWER_DISPLAY[r];

/** Motivos do status (contracts/review-gate.md, tabela de decisão). */
export const REASONS = {
  external: "PR de autor externo — não aceito",
  draft: "PR em rascunho — revisão começa quando estiver pronto",
  authorLabel: "rótulo de autor ausente ou ambíguo",
  mixedAgents: "PR com mais de um agente autor",
  labelMismatch: "rótulo de autor inconsistente com os commits",
  initiative: "rótulo de iniciativa ausente",
  noSpec: "PR sem spec (Constitution I)",
  amendment: "emenda sem versão/Sync Impact Report atualizados",
  emergency: "EMERGÊNCIA — revisão independente pós-merge em até 7 dias",
  emergencyLocked:
    "emergência não vale para PR que altera a constitution ou os mecanismos de revisão",
  emergencyNoReason: "emergência sem motivo registrado no PR",
  awaiting: (r: Reviewer) => `aguardando veredito de ${display(r)}`,
  stale: "veredito desatualizado — novo commit após a revisão",
  changes: (total: number, bySeverity: string) =>
    `mudanças necessárias: ${total} achado(s)${bySeverity ? ` (${bySeverity})` : ""}`,
  unanswered: (ns: number[]) => `achados sem resposta: ${ns.map((n) => `#${n}`).join(", ")}`,
  approved: (r: Reviewer, sha7: string, neutral: boolean) =>
    `APROVADO por ${display(r)} em ${sha7}${neutral ? " (rebase neutro)" : ""}`,
  apiError: "não foi possível avaliar (erro da API do GitHub) — reexecute",
} as const;

/** Rótulo de quem publicou um bloco de veredito sem ser o revisor designado. */
export function publisherDisplay(reviewer: Reviewer | null, isOwner: boolean): string {
  if (reviewer) return display(reviewer);
  return isOwner ? `${OWNER_LOGIN} (conta dos autores)` : "conta não autorizada";
}

/** Avisos (não mudam o estado — FR-010). */
export const WARNINGS = {
  notDesignated: (who: string) => `veredito de ${who} desconsiderado: não é o revisor designado`,
  badFormat: (detail: string) => `veredito fora do formato (${detail})`,
  incoherent: "veredito incoerente: APROVADO com achado CRÍTICO/ALTO",
  touchesGate: "PR altera o portão ou os revisores — revisão manual do Doug obrigatória",
} as const;

/** Detalhes de "fora do formato" (parseVerdict). */
export const FORMAT_ERRORS = {
  header: "sem cabeçalho Veredito",
  findings: "sem tabela Achados",
  coverage: "sem tabela Cobertura de requisitos",
  severity: "severidade inválida",
  number: "# repetido ou não inteiro",
  previousStatus: "situação inválida em Achados anteriores",
  coverageOk: "coluna OK? inválida",
  columns: "tabela com número de colunas errado",
  head: "sem head= no marcador",
  inputs: "sem Insumos lidos",
  previousIncomplete: "Achados anteriores incompletos",
  geminiComment: "veredito do Gemini precisa ser o corpo de uma review",
} as const;
