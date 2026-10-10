// Feature 002 · contracts/review-cli.md §pr:merge — `npm run pr:merge -- <n>` (só o Doug).
// Recalcula o portão, exige TTY e as confirmações do Doug; o ruleset revalida no servidor.
import { execFile } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { pathToFileURL } from "node:url";
import { commitAgent, labelAgent } from "../../src/review/authorship";
import { requiredChecksFromCi } from "../../src/review/ci-checks";
import { evaluateGate } from "../../src/review/evaluate-gate";
import { MERGE_MESSAGES, mergeReadiness } from "../../src/review/merge-readiness";
import { parsePrNumber } from "./gate";
import {
  buildPrSnapshot,
  compare,
  createGitHubClient,
  ghToken,
  listCheckRuns,
  readCiWorkflow,
  type Exec,
  type Sleep,
} from "./github";

export type { Exec };

export interface MergeDeps {
  argv: string[];
  isTty: boolean;
  exec: Exec;
  prompt: (question: string) => Promise<string>;
  fetch?: typeof fetch;
  sleep?: Sleep;
  log?: (msg: string) => void;
}

export async function runMerge(deps: MergeDeps): Promise<number> {
  const log = deps.log ?? console.log;
  const base = {
    gateSelfConfirmed: true,
    emergencyConfirmed: true,
    isTty: deps.isTty,
  };
  if (!deps.isTty) {
    log(MERGE_MESSAGES.noTty);
    return 8;
  }
  const n = parsePrNumber(deps.argv.find((a) => !a.startsWith("-")));
  if (n === null) {
    log("uso: npm run pr:merge -- <número do PR>");
    return 1;
  }
  try {
    const c = createGitHubClient({
      token: await ghToken(deps.exec),
      fetch: deps.fetch,
      sleep: deps.sleep,
    });
    const snapshot = await buildPrSnapshot(c, n);
    const gate = evaluateGate(snapshot);
    const input = {
      gate,
      requiredChecks: requiredChecksFromCi(await readCiWorkflow(c, "main")),
      checkRuns: await listCheckRuns(c, snapshot.headSha),
      behindBy: (await compare(c, snapshot.baseRef, snapshot.headSha))?.behind_by ?? 1,
    };
    const pre = mergeReadiness({ ...base, ...input });
    if (pre.exit !== 0) {
      pre.messages.forEach((m) => log(m));
      return pre.exit;
    }
    gate.warnings.forEach((w) => log(`aviso: ${w}`));
    const byCommits = commitAgent(snapshot.commits);
    if (labelAgent(snapshot.labels) === "doug" && byCommits.ok && byCommits.agent === "doug") {
      log(`aviso: ${MERGE_MESSAGES.dougNoTrailers}`);
    }
    let gateSelfConfirmed = false;
    let emergencyConfirmed = false;
    if (gate.touchesGate) {
      const a = await deps.prompt(
        "Este PR altera o portão ou os revisores. Você revisou esses arquivos manualmente? Digite 'revisei': ",
      );
      gateSelfConfirmed = a.trim() === "revisei";
    }
    if (gate.emergency) {
      const a = await deps.prompt(
        "PR de EMERGÊNCIA: confirme que foi você quem aplicou o rótulo e registrou o motivo. Digite 'emergencia': ",
      );
      emergencyConfirmed = a.trim() === "emergencia";
    }
    const final = mergeReadiness({ ...base, ...input, gateSelfConfirmed, emergencyConfirmed });
    if (final.exit !== 0) {
      final.messages.forEach((m) => log(m));
      return final.exit;
    }
    const r = await deps.exec("gh", [
      "pr",
      "merge",
      String(n),
      "--squash",
      "--delete-branch",
      "--match-head-commit",
      snapshot.headSha,
    ]);
    if (r.code !== 0) {
      log("gh pr merge falhou");
      return 1;
    }
    log(`PR #${n} integrado (squash). ${gate.reason}`);
    return 0;
  } catch (e) {
    log(`erro: ${e instanceof Error ? e.message : String(e)}`);
    return 1;
  }
}

export const realExec: Exec = (cmd, args) =>
  new Promise((resolve) => {
    execFile(cmd, args, { maxBuffer: 64 * 1024 * 1024 }, (err, stdout) =>
      resolve({ code: err ? ((err as { code?: number }).code ?? 1) : 0, stdout: String(stdout) }),
    );
  });

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const rl = () => createInterface({ input: process.stdin, output: process.stdout });
  runMerge({
    argv: process.argv.slice(2),
    isTty: Boolean(process.stdin.isTTY && process.stdout.isTTY),
    exec: realExec,
    prompt: async (q) => {
      const i = rl();
      try {
        return await i.question(q);
      } finally {
        i.close();
      }
    },
  }).then((code) => process.exit(code));
}
