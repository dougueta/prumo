// Entrada do `npm run synthetic`. Lógica e contrato em src/synthetic/cli.ts.
import { runCli } from "../src/synthetic/cli";

process.exit(runCli(process.argv.slice(2), process.env, console));
