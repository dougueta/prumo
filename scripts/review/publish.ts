// Feature 002 · contracts/review-cli.md §review:publish — `npm run review:publish -- <n>`.
// Só o Doug, no terminal dele: a senha da chave do app prumo-revisor é digitada sem eco a cada
// publicação (FR-017). Senha, chave e token nunca são impressos nem gravados.
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createAppJwt, KeyNotEncryptedError, WrongPassphraseError } from "../../src/review/app-jwt";
import type { Manifest } from "../../src/review/bundle";
import { REPO_NAME, REPO_FULL_NAME } from "../../src/review/catalog";
import { formatPublication } from "../../src/review/publish-format";
import { parsePrNumber } from "./gate";
import { GitHubApiError, REPO_PATH, createGitHubClient, getPull } from "./github";

export interface PublishDeps {
  argv: string[];
  cwd: string;
  isTty: boolean;
  readFile: (file: string) => string | null;
  promptSecret: (question: string) => Promise<string>;
  fetch?: typeof fetch;
  now: () => Date;
  log?: (msg: string) => void;
}

export const PUBLISH_MESSAGES = {
  noTty: "publicação exige o Doug no terminal",
  config: "configure PRUMO_REVISOR_CLIENT_ID e PRUMO_REVISOR_KEY_PATH (ver quickstart)",
  wrongPassword: "senha da chave incorreta",
  noBundle: (n: number) => `pacote .review/${n}/ incompleto — rode /revisar-pr ${n}`,
  notInstalled: "app prumo-revisor não instalado no repositório (ver quickstart §1.2)",
} as const;

function parseEnvFile(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const expandHome = (p: string) => (p.startsWith("~") ? path.join(homedir(), p.slice(1)) : p);

export async function runPublish(deps: PublishDeps): Promise<number> {
  const log = deps.log ?? console.log;
  if (!deps.isTty) {
    log(PUBLISH_MESSAGES.noTty);
    return 8;
  }
  const n = parsePrNumber(deps.argv.find((a) => !a.startsWith("-")));
  if (n === null) {
    log("uso: npm run review:publish -- <número do PR>");
    return 1;
  }
  const envText = deps.readFile(path.join(deps.cwd, ".env.review.local"));
  const env = envText ? parseEnvFile(envText) : {};
  const keyPem =
    env.PRUMO_REVISOR_CLIENT_ID && env.PRUMO_REVISOR_KEY_PATH
      ? deps.readFile(expandHome(env.PRUMO_REVISOR_KEY_PATH))
      : null;
  if (!keyPem) {
    log(PUBLISH_MESSAGES.config);
    return 5;
  }

  const dir = path.join(deps.cwd, ".review", String(n));
  const verdictText = deps.readFile(path.join(dir, "veredito.md"));
  const manifestText = deps.readFile(path.join(dir, "manifest.json"));
  if (!verdictText || !manifestText) {
    log(PUBLISH_MESSAGES.noBundle(n));
    return 1;
  }
  const manifest = JSON.parse(manifestText) as Manifest;
  // Formato primeiro (sem segredo envolvido); o head é conferido de novo antes de publicar.
  const draft = formatPublication({ verdictText, manifest, currentHead: manifest.headSha });
  if (!draft.ok) {
    draft.errors.forEach((e) => log(`veredito fora do formato: ${e}`));
    return draft.exit;
  }

  let jwt: string;
  try {
    const passphrase = await deps.promptSecret("Senha da chave do prumo-revisor: ");
    jwt = createAppJwt({
      clientId: env.PRUMO_REVISOR_CLIENT_ID,
      encryptedPem: keyPem,
      passphrase,
      now: deps.now(),
    });
  } catch (e) {
    if (e instanceof WrongPassphraseError) {
      log(PUBLISH_MESSAGES.wrongPassword);
      return 9;
    }
    if (e instanceof KeyNotEncryptedError) {
      log(e.message);
      return 5;
    }
    throw e;
  }

  try {
    const asApp = createGitHubClient({ token: jwt, fetch: deps.fetch });
    const installation = await asApp.getOptional<{ id: number }>(`${REPO_PATH}/installation`);
    if (!installation) {
      log(PUBLISH_MESSAGES.notInstalled);
      return 5;
    }
    const tokenRes = await asApp.request<{ token: string }>(
      "POST",
      `/app/installations/${installation.id}/access_tokens`,
      { body: { repositories: [REPO_NAME], permissions: { pull_requests: "write" } } },
    );
    const asRevisor = createGitHubClient({ token: tokenRes.data.token, fetch: deps.fetch });
    const currentHead = (await getPull(asRevisor, n)).head.sha;
    const final = formatPublication({ verdictText, manifest, currentHead });
    if (!final.ok) {
      final.errors.forEach((e) => log(e));
      return final.exit;
    }
    const created = await asRevisor.request<{ html_url?: string }>(
      "POST",
      `${REPO_PATH}/issues/${n}/comments`,
      { body: { body: final.body } },
    );
    log(
      `veredito publicado por prumo-revisor[bot]: ${created.data.html_url ?? `https://github.com/${REPO_FULL_NAME}/pull/${n}`}`,
    );
    return 0;
  } catch (e) {
    if (e instanceof GitHubApiError && (e.status === 401 || e.status === 403)) {
      log(`${e.message} — confira o Client ID, a chave e a instalação do app (ver quickstart)`);
      return 5;
    }
    log(`erro: ${e instanceof Error ? e.message : String(e)}`);
    return 1;
  }
}

/** Lê uma linha do terminal sem eco (a senha nunca aparece na tela). */
function promptSecretTty(question: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    process.stdout.write(question);
    let value = "";
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n" || ch === "\u0004") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          process.stdout.write("\n");
          resolve(value);
          return;
        }
        if (ch === "\u0003") {
          stdin.setRawMode(false);
          stdin.off("data", onData);
          process.stdout.write("\n");
          reject(new Error("cancelado"));
          return;
        }
        if (ch === "\u007f" || ch === "\b") value = value.slice(0, -1);
        else value += ch;
      }
    };
    stdin.on("data", onData);
  });
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  runPublish({
    argv: process.argv.slice(2),
    cwd: process.cwd(),
    isTty: Boolean(process.stdin.isTTY && process.stdout.isTTY),
    readFile: (f) => {
      try {
        return readFileSync(f, "utf8");
      } catch {
        return null;
      }
    },
    promptSecret: promptSecretTty,
    now: () => new Date(),
  })
    .then((code) => process.exit(code))
    .catch((e) => {
      console.error(`erro: ${e instanceof Error ? e.message : String(e)}`);
      process.exit(1);
    });
}
