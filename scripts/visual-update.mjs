// Regrava as baselines visuais (tests/e2e/visual.spec.ts-snapshots/) no mesmo Linux do CI:
// imagem oficial do Playwright, independente do SO de quem roda (spec 003, T005/T067).
// Uso: npm run test:visual:update   (requer Docker)
import { spawnSync } from "node:child_process";
import process from "node:process";

const IMAGE = "mcr.microsoft.com/playwright:v1.63.0-noble";
const cwd = process.cwd();
const script = [
  "npm ci",
  "npx next build",
  "VISUAL_ONLY=1 npx playwright test --project visual --update-snapshots",
].join(" && ");

const result = spawnSync(
  "docker",
  [
    "run",
    "--rm",
    "--ipc=host",
    "-e",
    "CI=",
    "-v",
    `${cwd}:/work`,
    // node_modules e .next do Linux ficam em volumes próprios (não misturam com os do host).
    "-v",
    "prumo-visual-node-modules:/work/node_modules",
    "-v",
    "prumo-visual-next:/work/.next",
    "-w",
    "/work",
    IMAGE,
    "bash",
    "-lc",
    script,
  ],
  { stdio: "inherit" },
);
process.exit(result.status ?? 1);
