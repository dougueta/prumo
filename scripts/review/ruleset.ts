// Feature 002 · contracts/review-cli.md §gh:ruleset — cria/atualiza (idempotente, pelo nome) o
// ruleset "main protegida". ⚠️ Escreve no GitHub: só o Doug executa, depois que o review-gate já
// publicou o status "Revisão independente" em ao menos um PR. Reexecute ao mudar jobs de PR do CI.
import { pathToFileURL } from "node:url";
import { RULESET_NAME } from "../../src/review/catalog";
import { requiredChecksFromCi } from "../../src/review/ci-checks";
import { buildRuleset } from "../../src/review/ruleset";
import { REPO_PATH, createGitHubClient, ghToken, readCiWorkflow } from "./github";
import { realExec } from "./merge";
import type { AdminDeps } from "./repo-settings";

export async function runRuleset(deps: AdminDeps): Promise<number> {
  const log = deps.log ?? console.log;
  try {
    const c = createGitHubClient({
      token: await ghToken(deps.exec),
      fetch: deps.fetch,
      sleep: deps.sleep,
    });
    const ruleset = buildRuleset(requiredChecksFromCi(await readCiWorkflow(c, "main")));
    const existing = (await c.paginate<{ id: number; name: string }>(`${REPO_PATH}/rulesets`)).find(
      (r) => r.name === RULESET_NAME,
    );
    const method = existing ? "PUT" : "POST";
    const path = existing ? `${REPO_PATH}/rulesets/${existing.id}` : `${REPO_PATH}/rulesets`;
    if (deps.argv.includes("--dry-run")) {
      log(`${method} ${path}\n${JSON.stringify(ruleset, null, 2)}`);
      return 0;
    }
    await c.request(method, path, { body: ruleset });
    log(`ruleset "${RULESET_NAME}" ${existing ? "atualizado" : "criado"}`);
    return 0;
  } catch (e) {
    log(`erro: ${e instanceof Error ? e.message : String(e)}`);
    return 1;
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  runRuleset({ argv: process.argv.slice(2), exec: realExec }).then((code) => process.exit(code));
}
