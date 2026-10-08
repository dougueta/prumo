// Feature 002 · C5 — regenera o espelho dos workflows (tests/unit/review/__snapshots__/workflows.md).
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { MIRROR_PATH } from "../../src/review/catalog";
import { renderWorkflowMirror } from "../../src/review/mirror";

const root = process.cwd();
const dir = path.join(root, ".github/workflows");
const entries = readdirSync(dir)
  .filter((f) => /\.ya?ml$/.test(f))
  .map((f) => ({
    path: `.github/workflows/${f}`,
    content: readFileSync(path.join(dir, f), "utf8").replace(/\r\n/g, "\n"),
  }));
mkdirSync(path.dirname(path.join(root, MIRROR_PATH)), { recursive: true });
writeFileSync(path.join(root, MIRROR_PATH), renderWorkflowMirror(entries));
console.log(`espelho atualizado: ${MIRROR_PATH} (${entries.length} workflows)`);
