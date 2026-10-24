// Sobe o build atual em modo demonstração (APP_ENV=preview), sem nenhuma credencial (demo-env.mjs).
import { spawn } from "node:child_process";
import { buildDemoEnv } from "./demo-env.mjs";

const port = process.argv[2] ?? "3001";
const mode = process.argv.includes("--dev") ? "dev" : "start";
const env = buildDemoEnv(process.env);
const child = spawn("npx", ["next", mode, "-p", port], { env, stdio: "inherit", shell: true });
child.on("exit", (code) => process.exit(code ?? 0));
