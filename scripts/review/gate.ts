// Feature 002 · contracts/review-gate.md — entrada do workflow review-gate.
// Lê só o número do PR (PR_NUMBER), o token do Actions e o id do run; tudo do PR vem da API como
// dado. Nunca executa código do PR. Saídas só com textos do catálogo, números e shas (FR-026).
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import {
  ACTIONS_BOT_LOGIN,
  REASONS,
  REPO_FULL_NAME,
  STATUS_CONTEXT,
  WARNINGS_MARKER,
} from "../../src/review/catalog";
import { evaluateGate } from "../../src/review/evaluate-gate";
import type { GateState, RawIssueComment } from "../../src/review/types";
import { renderWarningsComment } from "../../src/review/warnings-comment";
import {
  REPO_PATH,
  buildPrSnapshot,
  createGitHubClient,
  getPull,
  type GitHubClient,
  type Sleep,
} from "./github";

export interface GateDeps {
  env: Record<string, string | undefined>;
  fetch?: typeof fetch;
  sleep?: Sleep;
  writeSummary?: (markdown: string) => void;
  log?: (msg: string) => void;
}

export function parsePrNumber(raw: string | undefined): number | null {
  return raw && /^[1-9]\d{0,8}$/.test(raw) ? Number(raw) : null;
}

async function postStatus(
  c: GitHubClient,
  sha: string,
  state: GateState,
  description: string,
  targetUrl: string,
) {
  await c.request("POST", `${REPO_PATH}/statuses/${sha}`, {
    body: { state, context: STATUS_CONTEXT, description, target_url: targetUrl },
  });
}

/** Cria, atualiza ou apaga o comentário único de avisos (FR-010). */
async function syncWarnings(
  c: GitHubClient,
  n: number,
  comments: RawIssueComment[],
  body: string | null,
) {
  const existing = comments.find(
    (x) => x.user?.login === ACTIONS_BOT_LOGIN && (x.body ?? "").startsWith(WARNINGS_MARKER),
  );
  if (body === null) {
    if (existing) {
      await c.request("DELETE", `${REPO_PATH}/issues/comments/${existing.id}`, { allow404: true });
    }
    return;
  }
  if (!existing) {
    await c.request("POST", `${REPO_PATH}/issues/${n}/comments`, { body: { body } });
  } else if (existing.body !== body) {
    await c.request("PATCH", `${REPO_PATH}/issues/comments/${existing.id}`, { body: { body } });
  }
}

export async function runGate(deps: GateDeps): Promise<number> {
  const log = deps.log ?? console.log;
  const n = parsePrNumber(deps.env.PR_NUMBER);
  if (n === null) {
    log("PR_NUMBER inválido");
    return 1;
  }
  const token = deps.env.GITHUB_TOKEN;
  if (!token) {
    log("GITHUB_TOKEN ausente");
    return 1;
  }
  const runId = deps.env.RUN_ID;
  const targetUrl =
    runId && /^\d+$/.test(runId)
      ? `https://github.com/${REPO_FULL_NAME}/actions/runs/${runId}`
      : `https://github.com/${REPO_FULL_NAME}/pull/${n}`;
  const c = createGitHubClient({ token, fetch: deps.fetch, sleep: deps.sleep });

  let headSha: string | null = null;
  try {
    headSha = (await getPull(c, n)).head.sha;
    const snapshot = await buildPrSnapshot(c, n);
    headSha = snapshot.headSha;
    const result = evaluateGate(snapshot);
    await postStatus(c, headSha, result.state, result.reason, targetUrl);
    const body = result.warnings.length ? renderWarningsComment(headSha, result.warnings) : null;
    await syncWarnings(c, n, snapshot.issueComments, body);
    const summary = [
      `### ${STATUS_CONTEXT}: ${result.state}`,
      "",
      result.reason,
      ...(result.warnings.length
        ? ["", "**Avisos**", ...result.warnings.map((w) => `- ${w}`)]
        : []),
    ].join("\n");
    deps.writeSummary?.(summary);
    log(`${result.state}: ${result.reason}`);
    return 0;
  } catch (e) {
    log(`erro: ${e instanceof Error ? e.message : String(e)}`);
    if (headSha) {
      try {
        await postStatus(c, headSha, "pending", REASONS.apiError, targetUrl);
      } catch {
        // sem como publicar; o job falha de qualquer forma
      }
    }
    return 1;
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  runGate({
    env: process.env,
    writeSummary: summaryFile ? (md) => appendFileSync(summaryFile, `${md}\n`) : undefined,
  }).then((code) => process.exit(code));
}
