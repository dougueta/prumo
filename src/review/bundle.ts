// Feature 002 · data-model §3 — pacote fechado do revisor Claude limpo (FR-017, FR-018, FR-020).
// Puro: decide elegibilidade, o que entra no pacote e o manifest; o IO fica em scripts/review/bundle.ts.
import { createHash } from "node:crypto";
import { isExternal, labelAgent } from "./authorship";
import { CONSTITUTION_PATH, REASONS, REVIEWER_IDENTITY, RESPONSE_MARKER } from "./catalog";
import { isFeatureBranch } from "./classify-pr";
import { parseResponses } from "./parse-responses";
import { parseVerdict } from "./parse-verdict";
import type { RawIssueComment } from "./types";

export interface BundlePr {
  number: number;
  state: "open" | "closed";
  draft: boolean;
  labels: string[];
  authorLogin: string;
  headRepoFullName: string | null;
  headRef: string;
  headSha: string;
  baseSha: string;
}

export type Eligibility = { ok: true } | { ok: false; exit: 1 | 3; message: string };

export const BUNDLE_MESSAGES = {
  closed: (n: number) => `PR #${n} não encontrado ou fechado`,
  sameAgent: "revisor e autor são o mesmo agente",
  geminiReviews: "este PR é revisado pelo Gemini",
  draft: "PR em rascunho — aguarde ficar pronto",
} as const;

/** O revisor Claude limpo só revisa PRs abertos, prontos, internos e `autor:gemini`. */
export function checkBundleEligibility(pr: BundlePr): Eligibility {
  if (pr.state !== "open")
    return { ok: false, exit: 1, message: BUNDLE_MESSAGES.closed(pr.number) };
  if (isExternal(pr)) return { ok: false, exit: 3, message: REASONS.external };
  const author = labelAgent(pr.labels);
  if (!author) return { ok: false, exit: 3, message: REASONS.authorLabel };
  if (author === "claude") return { ok: false, exit: 3, message: BUNDLE_MESSAGES.sameAgent };
  if (author === "doug") return { ok: false, exit: 3, message: BUNDLE_MESSAGES.geminiReviews };
  if (pr.draft) return { ok: false, exit: 1, message: BUNDLE_MESSAGES.draft };
  return { ok: true };
}

export interface BundleSource {
  dest: string;
  ref: "head" | "main";
  path: string;
}

const SPEC_FILES = ["spec.md", "plan.md", "tasks.md", "data-model.md"];

/**
 * Arquivos do pacote: artefatos da spec do HEAD do PR; constitution, ADRs e checklist da main
 * (o PR não reescreve o que o avalia).
 */
export function planBundle(input: {
  headRef: string;
  headFiles: string[];
  mainAdrs: string[];
}): BundleSource[] {
  const out: BundleSource[] = [];
  if (isFeatureBranch(input.headRef)) {
    const dir = `specs/${input.headRef}/`;
    for (const f of SPEC_FILES) out.push({ dest: `spec/${f}`, ref: "head", path: `${dir}${f}` });
    for (const f of [...input.headFiles].sort()) {
      if (f.startsWith(`${dir}contracts/`)) {
        out.push({ dest: `spec/${f.slice(dir.length)}`, ref: "head", path: f });
      }
    }
  }
  out.push({ dest: "constitution.md", ref: "main", path: CONSTITUTION_PATH });
  for (const f of [...input.mainAdrs].sort()) {
    if (/^docs\/adr\/[^/]+\.md$/.test(f)) {
      out.push({ dest: `adr/${f.slice("docs/adr/".length)}`, ref: "main", path: f });
    }
  }
  out.push({ dest: "review-checklist.md", ref: "main", path: "docs/review-checklist.md" });
  return out;
}

export interface Manifest {
  pr: number;
  headSha: string;
  baseSha: string;
  branch: string;
  feature: string;
  generatedAt: string;
  files: { path: string; sha256: string }[];
}

export function buildManifest(input: {
  pr: number;
  headSha: string;
  baseSha: string;
  branch: string;
  generatedAt: string;
  files: { path: string; content: string | null }[];
}): Manifest {
  return {
    pr: input.pr,
    headSha: input.headSha,
    baseSha: input.baseSha,
    branch: input.branch,
    feature: input.branch,
    generatedAt: input.generatedAt,
    files: input.files.map((f) => ({
      path: f.path,
      sha256: f.content === null ? "ausente" : createHash("sha256").update(f.content).digest("hex"),
    })),
  };
}

/** Renderiza as respostas formais como tabelas (nunca texto livre). */
function renderResponses(comments: RawIssueComment[]): string {
  const blocks = comments
    .map(parseResponses)
    .filter((r) => r !== null && r.lines.length > 0)
    .map((r) =>
      [
        `<!-- respostas publicadas em ${r!.publishedAt} -->`,
        "| # | Ação | Commit ou justificativa |",
        "|---|---|---|",
        ...r!.lines.map((l) => `| ${l.n} | ${l.action} | ${l.ref.replace(/\|/g, "\\|")} |`),
      ].join("\n"),
    );
  return blocks.join("\n\n");
}

/**
 * Re-revisão: último veredito válido do prumo-revisor e as tabelas `prumo:respostas` publicadas
 * depois dele. Null quando não há veredito anterior.
 */
export function previousRound(
  comments: RawIssueComment[],
): { verdict: string; responses: string } | null {
  const sorted = [...comments].sort((a, b) =>
    a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : a.id - b.id,
  );
  const id = REVIEWER_IDENTITY.claude;
  const last = sorted
    .filter((c) => c.user?.login === id.login && c.user?.type === id.type)
    .filter((c) => parseVerdict(c.body ?? "", "claude").status === "ok")
    .at(-1);
  if (!last) return null;
  const after = sorted.filter(
    (c) => c.created_at > last.created_at && (c.body ?? "").includes(RESPONSE_MARKER),
  );
  return { verdict: last.body ?? "", responses: renderResponses(after) };
}
