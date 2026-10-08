// T068 · contracts/review-cli.md §review:publish — scripts/review/publish.ts com fetch/TTY/prompt
// falsos (FR-009, FR-017). A senha, a chave e o token nunca aparecem na saída.
import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { runPublish } from "../../../scripts/review/publish";
import { R, createFakeFetch, type Route } from "./fixtures/fake-fetch";
import { HEAD, OLD_HEAD, apiErrors, apiPull, verdictBody } from "./fixtures";

const SENHA = "senha-sintetica-123";
const TOKEN = "ghs_tokenDeInstalacaoSintetico";
const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const PEM = privateKey
  .export({ type: "pkcs8", format: "pem", cipher: "aes-256-cbc", passphrase: SENHA })
  .toString();
const manifest = {
  pr: 7,
  headSha: HEAD,
  baseSha: "c".repeat(40),
  branch: "010-x",
  feature: "010-x",
  generatedAt: "2026-10-06T12:00:00.000Z",
  files: [{ path: "diff.patch", sha256: "1".repeat(64) }],
};
const ENV_FILE = [
  "PRUMO_REVISOR_CLIENT_ID=Iv23liSintetico",
  "PRUMO_REVISOR_KEY_PATH=/home/doug/.prumo/prumo-revisor.pem",
  "PRUMO_REPO=dougueta/prumo",
].join("\n");

function files(over: Record<string, string | null> = {}): Record<string, string | null> {
  return {
    "/repo/.env.review.local": ENV_FILE,
    "/home/doug/.prumo/prumo-revisor.pem": PEM,
    "/repo/.review/7/veredito.md": verdictBody(),
    "/repo/.review/7/manifest.json": JSON.stringify(manifest),
    ...over,
  };
}

function routes(over: Record<string, Route> = {}): Record<string, Route> {
  return {
    [`GET ${R}/installation`]: { body: { id: 555 } },
    "POST /app/installations/555/access_tokens": {
      status: 201,
      body: { token: TOKEN, expires_at: "2026-10-06T13:00:00Z" },
    },
    [`GET ${R}/pulls/7`]: { body: apiPull({ number: 7 }) },
    [`POST ${R}/issues/7/comments`]: {
      status: 201,
      body: { id: 1, html_url: "https://github.com/dougueta/prumo/pull/7#issuecomment-1" },
    },
    ...over,
  };
}

async function run(
  opts: {
    files?: Record<string, string | null>;
    routes?: Record<string, Route>;
    tty?: boolean;
    password?: string;
  } = {},
) {
  const fake = createFakeFetch(opts.routes ?? routes());
  const fs = opts.files ?? files();
  const out: string[] = [];
  const stdout = vi.spyOn(process.stdout, "write");
  const stderr = vi.spyOn(process.stderr, "write");
  const consoleLog = vi.spyOn(console, "log");
  const consoleErr = vi.spyOn(console, "error");
  const code = await runPublish({
    argv: ["7"],
    cwd: "/repo",
    isTty: opts.tty ?? true,
    readFile: (p) => fs[p.replace(/\\/g, "/").replace(/^[A-Za-z]:/, "")] ?? null,
    promptSecret: async () => opts.password ?? SENHA,
    fetch: fake.fetch,
    now: () => new Date("2026-10-06T12:00:00Z"),
    log: (m) => out.push(m),
  });
  const printed = [
    ...out,
    ...stdout.mock.calls.map((c) => String(c[0])),
    ...stderr.mock.calls.map((c) => String(c[0])),
    ...consoleLog.mock.calls.map((c) => c.join(" ")),
    ...consoleErr.mock.calls.map((c) => c.join(" ")),
  ].join("\n");
  vi.restoreAllMocks();
  return { code, calls: fake.calls, printed };
}

const expectNoSecrets = (printed: string) => {
  expect(printed).not.toContain(SENHA);
  expect(printed).not.toContain(TOKEN);
  expect(printed).not.toContain("PRIVATE KEY");
  expect(printed).not.toContain(PEM.split("\n")[1]);
};

describe("runPublish", () => {
  it("fluxo completo: installation (JWT) → token restrito → comentário (token de instalação)", async () => {
    const { code, calls, printed } = await run();
    expect(code).toBe(0);
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      `GET ${R}/installation`,
      "POST /app/installations/555/access_tokens",
      `GET ${R}/pulls/7`,
      `POST ${R}/issues/7/comments`,
    ]);
    expect(calls[0].headers.authorization).toMatch(/^Bearer [\w-]+\.[\w-]+\.[\w-]+$/);
    expect(calls[1].headers.authorization).toBe(calls[0].headers.authorization);
    expect(calls[1].body).toEqual({
      repositories: ["prumo"],
      permissions: { pull_requests: "write" },
    });
    expect(calls[2].headers.authorization).toBe(`Bearer ${TOKEN}`);
    expect(calls[3].headers.authorization).toBe(`Bearer ${TOKEN}`);
    const body = (calls[3].body as { body: string }).body;
    expect(body.startsWith(`<!-- prumo:veredito v1 head=${HEAD} -->`)).toBe(true);
    expect(body).toContain("### Insumos lidos");
    expect(printed).toContain("https://github.com/dougueta/prumo/pull/7#issuecomment-1");
    expectNoSecrets(printed);
  });

  it("fora de TTY ⇒ exit 8, nada lido nem publicado", async () => {
    const { code, calls, printed } = await run({ tty: false });
    expect(code).toBe(8);
    expect(calls).toEqual([]);
    expect(printed).toContain("publicação exige o Doug no terminal");
  });

  it("sem .env.review.local ⇒ exit 5", async () => {
    const { code, calls, printed } = await run({
      files: files({ "/repo/.env.review.local": null }),
    });
    expect(code).toBe(5);
    expect(calls).toEqual([]);
    expect(printed).toContain("configure PRUMO_REVISOR_CLIENT_ID e PRUMO_REVISOR_KEY_PATH");
  });

  it("chave ausente no caminho ⇒ exit 5", async () => {
    const { code } = await run({ files: files({ "/home/doug/.prumo/prumo-revisor.pem": null }) });
    expect(code).toBe(5);
  });

  it("senha incorreta ⇒ exit 9 sem chamar a API", async () => {
    const { code, calls, printed } = await run({ password: "errada-123" });
    expect(code).toBe(9);
    expect(calls).toEqual([]);
    expect(printed).toContain("senha da chave incorreta");
    expect(printed).not.toContain("errada-123");
  });

  it("veredito fora do formato ⇒ exit 2 antes de pedir a senha", async () => {
    const prompt = vi.fn(async () => SENHA);
    const fake = createFakeFetch(routes());
    const fs = files({ "/repo/.review/7/veredito.md": verdictBody({ findings: [[1, "GRAVE"]] }) });
    const code = await runPublish({
      argv: ["7"],
      cwd: "/repo",
      isTty: true,
      readFile: (p) => fs[p.replace(/\\/g, "/").replace(/^[A-Za-z]:/, "")] ?? null,
      promptSecret: prompt,
      fetch: fake.fetch,
      now: () => new Date("2026-10-06T12:00:00Z"),
      log: () => {},
    });
    expect(code).toBe(2);
    expect(prompt).not.toHaveBeenCalled();
  });

  it("head mudou desde o pacote ⇒ exit 4, nada publicado", async () => {
    const { code, calls } = await run({
      routes: routes({
        [`GET ${R}/pulls/7`]: {
          body: apiPull({
            number: 7,
            head: { sha: OLD_HEAD, ref: "010-x", repo: { full_name: "dougueta/prumo" } },
          }),
        },
      }),
    });
    expect(code).toBe(4);
    expect(calls.some((c) => c.method === "POST" && c.path.endsWith("/comments"))).toBe(false);
  });

  it("app não instalado (404) ⇒ exit 5", async () => {
    const { code } = await run({
      routes: routes({ [`GET ${R}/installation`]: apiErrors.notFound }),
    });
    expect(code).toBe(5);
  });
});
