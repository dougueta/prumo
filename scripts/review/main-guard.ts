// Feature 002 · contracts/review-gate.md §main-guard — job "Guarda da main" do ci.yml (modo push)
// e workflow agendado main-guard.yml (modo schedule: emergências pós-merge).
import { pathToFileURL } from "node:url";
import {
  EMERGENCY_ISSUE_PREFIX,
  EMERGENCY_LABEL,
  OWNER_LOGIN,
  REPO_FULL_NAME,
  VIOLATION_LABEL,
} from "../../src/review/catalog";
import { requiredChecksFromCi } from "../../src/review/ci-checks";
import { mainGuard } from "../../src/review/main-guard";
import {
  REPO_PATH,
  buildPrSnapshot,
  createGitHubClient,
  listCheckRuns,
  readCiWorkflow,
  type GitHubClient,
  type Sleep,
} from "./github";

export interface MainGuardDeps {
  mode: "push" | "schedule";
  env: Record<string, string | undefined>;
  fetch?: typeof fetch;
  sleep?: Sleep;
  log?: (msg: string) => void;
  now?: () => Date;
}

interface ApiIssue {
  number: number;
  title: string;
  pull_request?: unknown;
}

export async function openIssues(c: GitHubClient, label: string): Promise<ApiIssue[]> {
  const all = await c.paginate<ApiIssue>(`${REPO_PATH}/issues`, { labels: label, state: "open" });
  return all.filter((i) => !i.pull_request);
}

/** Cria a issue só se não houver uma aberta com o mesmo título (idempotente). */
async function ensureIssue(c: GitHubClient, label: string, title: string, body: string) {
  if ((await openIssues(c, label)).some((i) => i.title === title)) return false;
  await c.request("POST", `${REPO_PATH}/issues`, {
    body: { title, body, labels: [label], assignees: [OWNER_LOGIN] },
  });
  return true;
}

async function runPush(c: GitHubClient, env: MainGuardDeps["env"], log: (m: string) => void) {
  const sha = env.COMMIT_SHA ?? "";
  if (!/^[0-9a-f]{40}$/.test(sha)) {
    log("COMMIT_SHA inválido");
    return 1;
  }
  const commit = (
    await c.request<{ parents: { sha: string }[] }>("GET", `${REPO_PATH}/commits/${sha}`)
  ).data;
  const pulls = (
    await c.request<
      { number: number; merged_at: string | null; merge_commit_sha: string | null }[]
    >("GET", `${REPO_PATH}/commits/${sha}/pulls`)
  ).data;
  const merged = pulls.find((p) => p.merged_at !== null && p.merge_commit_sha === sha);
  const pr = merged ? await buildPrSnapshot(c, merged.number) : undefined;
  const requiredChecks = pr ? requiredChecksFromCi(await readCiWorkflow(c, sha)) : [];
  const checkRuns = pr ? await listCheckRuns(c, pr.headSha) : [];
  const result = mainGuard({
    commit: { sha, parents: commit.parents.map((p) => p.sha) },
    pr,
    requiredChecks,
    checkRuns,
  });

  if (!result.ok) {
    const title = `Violação da proteção da main: ${sha.slice(0, 7)}`;
    const body = [
      `O commit https://github.com/${REPO_FULL_NAME}/commit/${sha} chegou à \`main\` fora do fluxo protegido`,
      pr ? `(PR #${pr.number}).` : "(nenhum PR integrado gerou este commit).",
      "",
      ...result.reasons.map((r) => `- ${r}`),
      "",
      "As migrações de produção (`deploy-db`) não foram aplicadas para este commit.",
      "Reverta por PR ou regularize a revisão independente (Constitution VIII).",
    ].join("\n");
    await ensureIssue(c, VIOLATION_LABEL, title, body);
    log(`violação: ${result.reasons.join("; ")}`);
    return 1;
  }
  if (result.emergencyPr) {
    const n = result.emergencyPr;
    await ensureIssue(
      c,
      EMERGENCY_LABEL,
      `${EMERGENCY_ISSUE_PREFIX}${n}`,
      [
        `O PR #${n} foi integrado como **emergência** (rótulo \`${EMERGENCY_LABEL}\`).`,
        "",
        "A revisão independente pós-merge é obrigatória em até 7 dias (Constitution VIII).",
        "Esta issue fecha sozinha quando o revisor designado publicar um veredito válido no PR;",
        "depois do prazo, o título passa a começar com `VENCIDA —`.",
      ].join("\n"),
    );
    log(`emergência: revisão pós-merge pendente do PR #${n}`);
  }
  log("ok");
  return 0;
}

export async function runMainGuard(deps: MainGuardDeps): Promise<number> {
  const log = deps.log ?? console.log;
  const token = deps.env.GITHUB_TOKEN;
  if (!token) {
    log("GITHUB_TOKEN ausente");
    return 1;
  }
  const c = createGitHubClient({ token, fetch: deps.fetch, sleep: deps.sleep });
  try {
    if (deps.mode === "push") return await runPush(c, deps.env, log);
    log("modo schedule ainda não implementado");
    return 1;
  } catch (e) {
    log(`erro: ${e instanceof Error ? e.message : String(e)}`);
    return 1;
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const mode = process.argv.includes("--mode=schedule") ? "schedule" : "push";
  runMainGuard({ mode, env: process.env }).then((code) => process.exit(code));
}
