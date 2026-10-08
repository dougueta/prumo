// Fixtures 100% sintéticas no formato da API do GitHub (contracts/github-api.openapi.yaml).
// Nenhum dado real; shas e ids são inventados.
import type {
  PrSnapshot,
  RawIssueComment,
  RawReview,
  RawReviewComment,
  RawUser,
} from "../../../../src/review/types";

export const sha = (c: string) => c.repeat(40).slice(0, 40);
export const HEAD = sha("a");
export const OLD_HEAD = sha("b");
export const BASE = sha("c");

export const users = {
  gemini: { login: "gemini-code-assist[bot]", type: "Bot" },
  revisor: { login: "prumo-revisor[bot]", type: "Bot" },
  doug: { login: "dougueta", type: "User" },
  thirdParty: { login: "terceiro", type: "User" },
  fakeGemini: { login: "gemini-code-assist", type: "User" },
  actions: { login: "github-actions[bot]", type: "Bot" },
} satisfies Record<string, RawUser>;

// ---------- blocos de veredito ----------

export interface VerdictOpts {
  outcome?: "APROVADO" | "MUDANÇAS NECESSÁRIAS";
  findings?: [number, string][]; // [#, severidade]
  previous?: [number, string][]; // [#, situação]
  head?: string; // marcador head=
  inputs?: string[]; // Insumos lidos
  preamble?: string;
  coverage?: boolean;
}

export function verdictBody(o: VerdictOpts = {}): string {
  const outcome = o.outcome ?? "APROVADO";
  const marker = o.head
    ? `<!-- prumo:veredito v1 head=${o.head} -->`
    : "<!-- prumo:veredito v1 -->";
  const lines = [
    o.preamble ?? "",
    marker,
    `## Veredito: ${outcome}`,
    "",
    "### Achados",
    "| # | Severidade | Arquivo:linha | Princípio | Problema | Sugestão |",
    "|---|---|---|---|---|---|",
  ];
  const findings = o.findings ?? [];
  if (findings.length === 0) lines.push("| — | — | — | — | — | — |");
  for (const [n, sev] of findings) {
    lines.push(`| ${n} | ${sev} | src/exemplo.ts:${n} | III | problema ${n} | sugestão ${n} |`);
  }
  if (o.previous) {
    lines.push("", "### Achados anteriores", "| # | Situação |", "|---|---|");
    for (const [n, st] of o.previous) lines.push(`| ${n} | ${st} |`);
  }
  if (o.coverage !== false) {
    lines.push(
      "",
      "### Cobertura de requisitos",
      "| FR | Implementado em | Testado em | OK? |",
      "|---|---|---|---|",
      "| FR-001 | src/exemplo.ts | tests/unit/exemplo.test.ts | ✅ |",
    );
  }
  if (o.inputs) {
    lines.push("", "### Insumos lidos", ...o.inputs.map((i) => `- ${i}`));
  }
  return lines.join("\n");
}

/** Review do Gemini como a API devolve (corpo começa com o resumo "## Code Review"). */
export function geminiReview(p: {
  id: number;
  at: string;
  commit?: string;
  body?: string;
  user?: RawUser;
}): RawReview {
  return {
    id: p.id,
    user: p.user ?? users.gemini,
    body: p.body ?? `## Code Review\n\nResumo sintético.\n\n${verdictBody()}`,
    commit_id: p.commit ?? HEAD,
    submitted_at: p.at,
    state: "COMMENTED",
  };
}

export function issueComment(p: {
  id: number;
  at: string;
  body: string;
  user?: RawUser;
}): RawIssueComment {
  return { id: p.id, user: p.user ?? users.doug, body: p.body, created_at: p.at };
}

/** Comentário de linha do Gemini com selo de severidade. */
export function inlineComment(p: {
  id: number;
  reviewId: number;
  sev: "critical" | "high" | "medium" | "low";
}): RawReviewComment {
  return {
    id: p.id,
    pull_request_review_id: p.reviewId,
    body: `![${p.sev}](https://www.gstatic.com/codereviewagent/${p.sev}-priority.svg)\n\nComentário sintético.`,
    user: users.gemini,
  };
}

export function responsesBody(lines: [number, string, string][]): string {
  return [
    "<!-- prumo:respostas v1 -->",
    "## Respostas aos achados",
    "| # | Ação | Commit ou justificativa |",
    "|---|---|---|",
    ...lines.map(([n, a, r]) => `| ${n} | ${a} | ${r} |`),
  ].join("\n");
}

export const warningsCommentBody =
  '<!-- prumo:avisos v1 -->\n**Avisos da verificação "Revisão independente"** (head `aaaaaaa`)\n- algo';

export const trailers = {
  claude: "feat(002): exemplo\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>",
  gemini: "feat(010): exemplo\n\nCo-Authored-By: Gemini <noreply@google.com>",
  none: "fix: ajuste manual do Doug",
};

export const constitutionPatch = {
  versioned:
    "@@ -1,3 +1,3 @@\n-- Version change: 1.1.0 → 1.2.0\n+- Version change: 1.2.0 → 1.3.0\n@@ -220 +220 @@\n-**Version**: 1.2.0 | **Ratified**: 2026-10-02\n+**Version**: 1.3.0 | **Ratified**: 2026-10-02",
  unversioned: "@@ -100,1 +100,1 @@\n-texto antigo\n+texto novo",
};

/** Snapshot de um PR feliz: autor:claude, aprovado pelo Gemini no head atual. */
export function makeSnapshot(over: Partial<PrSnapshot> = {}): PrSnapshot {
  return {
    number: 42,
    draft: false,
    merged: false,
    authorLogin: "dougueta",
    headRepoFullName: "dougueta/prumo",
    headSha: HEAD,
    headRef: "999-exemplo",
    baseRef: "main",
    body: "Corpo sintético.",
    labels: ["autor:claude", "iniciativa:0"],
    changedFiles: ["src/app/page.tsx", "specs/999-exemplo/spec.md"],
    commits: [{ sha: HEAD, message: trailers.claude }],
    specExists: true,
    fingerprints: { [HEAD]: "fp-1" },
    reviews: [geminiReview({ id: 1, at: "2026-10-06T10:00:00Z" })],
    reviewComments: [],
    issueComments: [],
    ...over,
  };
}

// ---------- respostas cruas da API ----------

export function apiPull(over: Record<string, unknown> = {}) {
  return {
    number: 42,
    draft: false,
    state: "open",
    merged_at: null,
    merge_commit_sha: null,
    body: "Corpo sintético.",
    user: users.doug,
    head: { sha: HEAD, ref: "999-exemplo", repo: { full_name: "dougueta/prumo" } },
    base: { sha: BASE, ref: "main" },
    labels: [{ name: "autor:claude" }, { name: "iniciativa:0" }],
    ...over,
  };
}

export const apiForkPull = () =>
  apiPull({
    user: users.thirdParty,
    head: { sha: HEAD, ref: "patch-1", repo: { full_name: "terceiro/prumo" } },
  });

export const apiDeletedForkPull = () =>
  apiPull({ head: { sha: HEAD, ref: "patch-1", repo: null } });

export const apiFiles = [
  { filename: "src/app/page.tsx", status: "modified", patch: "@@ -1,2 +1,2 @@\n-a\n+b" },
  { filename: "specs/999-exemplo/spec.md", status: "added", patch: "@@ -0,0 +1 @@\n+# Spec" },
];

export const apiCompare = (over: Record<string, unknown> = {}) => ({
  status: "ahead",
  ahead_by: 1,
  behind_by: 0,
  files: apiFiles,
  ...over,
});

export const apiCompareNoPatch = () =>
  apiCompare({ files: [{ filename: "public/icon.png", status: "added" }] });

export const apiCheckRuns = (
  runs: { name: string; conclusion: string | null; slug?: string }[],
) => ({
  total_count: runs.length,
  check_runs: runs.map((r) => ({
    name: r.name,
    status: "completed",
    conclusion: r.conclusion,
    app: { slug: r.slug ?? "github-actions" },
  })),
});

export const CI_JOB_NAMES = [
  "Qualidade (lint, formato, tipos)",
  "Testes unitários",
  "Testes de integração (Supabase efêmero)",
  "Testes ponta a ponta (Playwright)",
];

export const greenCheckRuns = () =>
  CI_JOB_NAMES.map((name) => ({ name, conclusion: "success", appSlug: "github-actions" }));

export const apiErrors = {
  forbidden: { status: 403, body: { message: "Resource not accessible by integration" } },
  rateLimited: {
    status: 403,
    headers: { "x-ratelimit-remaining": "0", "retry-after": "1" },
    body: { message: "API rate limit exceeded" },
  },
  tooMany: { status: 429, headers: { "retry-after": "1" }, body: { message: "Too many" } },
  notFound: { status: 404, body: { message: "Not Found" } },
  unprocessable: { status: 422, body: { message: "Validation Failed" } },
  serverError: { status: 502, body: { message: "Bad Gateway" } },
};
