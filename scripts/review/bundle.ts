// Feature 002 · contracts/review-cli.md §review:bundle — monta `.review/<n>/` para o revisor
// Claude limpo. Só LÊ dados (gh/git); nenhum arquivo do PR é executado.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { REPO_FULL_NAME } from "../../src/review/catalog";
import {
  BUNDLE_MESSAGES,
  buildManifest,
  checkBundleEligibility,
  planBundle,
  previousRound,
  type BundlePr,
} from "../../src/review/bundle";
import type { RawIssueComment } from "../../src/review/types";
import { parsePrNumber } from "./gate";
import type { Exec } from "./github";
import { realExec } from "./merge";

export interface BundleDeps {
  argv: string[];
  cwd: string;
  exec: Exec;
  writeFile: (file: string, content: string) => void;
  mkdir: (dir: string) => void;
  removeDir: (dir: string) => void;
  now: () => Date;
  log?: (msg: string) => void;
}

interface GhPr {
  number: number;
  state: string;
  isDraft: boolean;
  labels: { name: string }[];
  author: { login: string } | null;
  headRefName: string;
  headRefOid: string;
  baseRefOid: string;
  isCrossRepository: boolean;
  headRepository: { name: string } | null;
  headRepositoryOwner: { login: string } | null;
}

const PR_FIELDS =
  "number,state,isDraft,labels,author,headRefName,headRefOid,baseRefOid,isCrossRepository,headRepository,headRepositoryOwner";

function toBundlePr(p: GhPr): BundlePr {
  const headRepoFullName =
    p.headRepository && p.headRepositoryOwner
      ? p.isCrossRepository
        ? `${p.headRepositoryOwner.login}/${p.headRepository.name}`
        : REPO_FULL_NAME
      : null;
  return {
    number: p.number,
    state: p.state === "OPEN" ? "open" : "closed",
    draft: p.isDraft,
    labels: p.labels.map((l) => l.name),
    authorLogin: p.author?.login ?? "",
    headRepoFullName,
    headRef: p.headRefName,
    headSha: p.headRefOid,
    baseSha: p.baseRefOid,
  };
}

export async function runBundle(deps: BundleDeps): Promise<number> {
  const log = deps.log ?? console.log;
  const n = parsePrNumber(deps.argv.find((a) => !a.startsWith("-")));
  if (n === null) {
    log("uso: npm run review:bundle -- <número do PR>");
    return 1;
  }
  const view = await deps.exec("gh", [
    "pr",
    "view",
    String(n),
    "--repo",
    REPO_FULL_NAME,
    "--json",
    PR_FIELDS,
  ]);
  if (view.code !== 0) {
    log(BUNDLE_MESSAGES.closed(n));
    return 1;
  }
  const pr = toBundlePr(JSON.parse(view.stdout) as GhPr);
  const eligible = checkBundleEligibility(pr);
  if (!eligible.ok) {
    log(eligible.message);
    return eligible.exit;
  }

  const git = async (...args: string[]) => {
    const r = await deps.exec("git", args);
    if (r.code !== 0 && args[0] !== "show") throw new Error(`git ${args[0]} falhou`);
    return r;
  };
  await git("fetch", "origin", `pull/${n}/head`, "main");
  const diff = (await git("diff", `${pr.baseSha}...${pr.headSha}`)).stdout;
  const headFiles = (
    await git("ls-tree", "-r", "--name-only", pr.headSha, "--", `specs/${pr.headRef}/`)
  ).stdout
    .split("\n")
    .filter(Boolean);
  const mainAdrs = (await git("ls-tree", "--name-only", "origin/main", "--", "docs/adr/")).stdout
    .split("\n")
    .filter(Boolean);

  const files: { path: string; content: string | null }[] = [{ path: "diff.patch", content: diff }];
  for (const s of planBundle({ headRef: pr.headRef, headFiles, mainAdrs })) {
    const ref = s.ref === "head" ? pr.headSha : "origin/main";
    const r = await git("show", `${ref}:${s.path}`);
    files.push({ path: s.dest, content: r.code === 0 ? r.stdout : null });
  }

  const comments = await deps.exec("gh", [
    "api",
    `repos/${REPO_FULL_NAME}/issues/${n}/comments`,
    "--paginate",
    "--jq",
    ".[]",
  ]);
  if (comments.code !== 0) throw new Error("não foi possível ler os comentários do PR");
  const parsed = comments.stdout
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as RawIssueComment);
  const previous = previousRound(parsed);
  if (previous) {
    files.push({ path: "anteriores/veredito.md", content: previous.verdict });
    files.push({ path: "anteriores/respostas.md", content: previous.responses });
  }

  const root = path.join(deps.cwd, ".review", String(n));
  deps.removeDir(root);
  for (const f of files) {
    if (f.content === null) continue;
    const target = path.join(root, ...f.path.split("/"));
    deps.mkdir(path.dirname(target));
    deps.writeFile(target, f.content);
  }
  const manifest = buildManifest({
    pr: n,
    headSha: pr.headSha,
    baseSha: pr.baseSha,
    branch: pr.headRef,
    generatedAt: deps.now().toISOString(),
    files,
  });
  deps.writeFile(path.join(root, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  log(`pacote de revisão: .review/${n}/`);
  for (const f of manifest.files) log(`  ${f.path}${f.sha256 === "ausente" ? " (ausente)" : ""}`);
  return 0;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  runBundle({
    argv: process.argv.slice(2),
    cwd: process.cwd(),
    exec: realExec,
    writeFile: (f, c) => writeFileSync(f, c),
    mkdir: (d) => mkdirSync(d, { recursive: true }),
    removeDir: (d) => rmSync(d, { recursive: true, force: true }),
    now: () => new Date(),
  })
    .then((code) => process.exit(code))
    .catch((e) => {
      console.error(`erro: ${e instanceof Error ? e.message : String(e)}`);
      process.exit(1);
    });
}
