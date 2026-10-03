// Sobe o build atual em modo demonstração (APP_ENV=preview), removendo qualquer SUPABASE_*.
import { spawn } from "node:child_process";

const port = process.argv[2] ?? "3001";
const mode = process.argv.includes("--dev") ? "dev" : "start";
const env = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !key.startsWith("SUPABASE_")),
);
env.APP_ENV = "preview";
const child = spawn("npx", ["next", mode, "-p", port], { env, stdio: "inherit", shell: true });
child.on("exit", (code) => process.exit(code ?? 0));
