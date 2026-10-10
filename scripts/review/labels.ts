// Feature 002 · contracts/review-cli.md §gh:labels — aplica rótulos e marcos (idempotente, nunca
// apaga). ⚠️ Escreve no GitHub: só o Doug executa (use --dry-run antes).
import { pathToFileURL } from "node:url";
import {
  DESIRED_LABELS,
  DESIRED_MILESTONES,
  planLabels,
  planMilestones,
  type LabelSpec,
} from "../../src/review/labels";
import { GitHubApiError, REPO_PATH, createGitHubClient, ghToken } from "./github";
import { realExec } from "./merge";
import type { AdminDeps } from "./repo-settings";

export async function runLabels(deps: AdminDeps): Promise<number> {
  const log = deps.log ?? console.log;
  const dryRun = deps.argv.includes("--dry-run");
  try {
    const c = createGitHubClient({
      token: await ghToken(deps.exec),
      fetch: deps.fetch,
      sleep: deps.sleep,
    });
    const labels = await c.paginate<LabelSpec>(`${REPO_PATH}/labels`);
    const milestones = await c.paginate<{ title: string }>(`${REPO_PATH}/milestones`, {
      state: "all",
    });
    const plan = planLabels(labels, DESIRED_LABELS);
    const newMilestones = planMilestones(
      milestones.map((m) => m.title),
      DESIRED_MILESTONES,
    );
    const patch = (l: LabelSpec) =>
      c.request("PATCH", `${REPO_PATH}/labels/${encodeURIComponent(l.name)}`, {
        body: { new_name: l.name, color: l.color, description: l.description },
      });
    for (const l of plan.create) {
      log(`criar rótulo ${l.name}`);
      if (dryRun) continue;
      try {
        await c.request("POST", `${REPO_PATH}/labels`, { body: l });
      } catch (e) {
        if (e instanceof GitHubApiError && e.status === 422) await patch(l);
        else throw e;
      }
    }
    for (const l of plan.update) {
      log(`atualizar rótulo ${l.name}`);
      if (!dryRun) await patch(l);
    }
    for (const title of newMilestones) {
      log(`criar marco ${title}`);
      if (!dryRun) await c.request("POST", `${REPO_PATH}/milestones`, { body: { title } });
    }
    if (!plan.create.length && !plan.update.length && !newMilestones.length) log("nada a fazer");
    return 0;
  } catch (e) {
    log(`erro: ${e instanceof Error ? e.message : String(e)}`);
    return 1;
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  runLabels({ argv: process.argv.slice(2), exec: realExec }).then((code) => process.exit(code));
}
