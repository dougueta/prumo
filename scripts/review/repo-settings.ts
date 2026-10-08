// Feature 002 · contracts/review-cli.md §gh:repo-settings — só squash e apagar branch após merge
// (FR-003). ⚠️ Escreve no GitHub: só o Doug executa (use --dry-run antes).
import { pathToFileURL } from "node:url";
import { REPO_PATH, createGitHubClient, ghToken, type Exec, type Sleep } from "./github";
import { realExec } from "./merge";

export const REPO_SETTINGS = {
  allow_squash_merge: true,
  allow_merge_commit: false,
  allow_rebase_merge: false,
  delete_branch_on_merge: true,
  allow_update_branch: true,
} as const;

export interface AdminDeps {
  argv: string[];
  exec: Exec;
  fetch?: typeof fetch;
  sleep?: Sleep;
  log?: (msg: string) => void;
}

export async function runRepoSettings(deps: AdminDeps): Promise<number> {
  const log = deps.log ?? console.log;
  if (deps.argv.includes("--dry-run")) {
    log(`PATCH ${REPO_PATH}\n${JSON.stringify(REPO_SETTINGS, null, 2)}`);
    return 0;
  }
  try {
    const c = createGitHubClient({
      token: await ghToken(deps.exec),
      fetch: deps.fetch,
      sleep: deps.sleep,
    });
    await c.request("PATCH", REPO_PATH, { body: REPO_SETTINGS });
    log("configurações de merge aplicadas (só squash; branch apagada após o merge)");
    return 0;
  } catch (e) {
    log(`erro: ${e instanceof Error ? e.message : String(e)}`);
    return 1;
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  runRepoSettings({ argv: process.argv.slice(2), exec: realExec }).then((code) =>
    process.exit(code),
  );
}
