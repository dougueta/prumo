// T013 · contracts/github-api.openapi.yaml — cliente mínimo e montador de PrSnapshot
// (FR-002, FR-007, FR-009, FR-026). fetch falso; nenhuma chamada de rede.
import { describe, expect, it, vi } from "vitest";
import {
  buildPrSnapshot,
  createGitHubClient,
  GitHubApiError,
  listCheckRuns,
  readCiWorkflow,
} from "../../../scripts/review/github";
import { API, R, createFakeFetch, type Route } from "./fixtures/fake-fetch";
import {
  HEAD,
  OLD_HEAD,
  apiCheckRuns,
  apiCompare,
  apiCompareNoPatch,
  apiDeletedForkPull,
  apiErrors,
  apiFiles,
  apiPull,
  geminiReview,
  issueComment,
  trailers,
  users,
  verdictBody,
} from "./fixtures";

const P = `${R}/pulls/42`;
const b64 = (s: string) => Buffer.from(s).toString("base64");

function prRoutes(over: Record<string, Route> = {}): Record<string, Route> {
  return {
    [`GET ${P}`]: { body: apiPull() },
    [`GET ${P}/commits`]: { body: [{ sha: HEAD, commit: { message: trailers.claude } }] },
    [`GET ${P}/files`]: { body: apiFiles },
    [`GET ${P}/reviews`]: {
      body: [geminiReview({ id: 1, at: "2026-10-06T10:00:00Z", commit: OLD_HEAD })],
    },
    [`GET ${P}/comments`]: {
      body: [
        {
          id: 7,
          pull_request_review_id: 1,
          body: "![high](https://www.gstatic.com/codereviewagent/high-priority.svg)",
          user: users.gemini,
        },
      ],
    },
    [`GET ${R}/issues/42/comments`]: {
      body: [
        issueComment({
          id: 9,
          at: "2026-10-06T11:00:00Z",
          user: users.revisor,
          body: verdictBody({ head: "e".repeat(40), inputs: ["diff.patch"] }),
        }),
      ],
    },
    [`GET ${R}/contents/specs/999-exemplo/spec.md`]: { body: { content: b64("# spec") } },
    [`GET ${R}/compare/main...${HEAD}`]: { body: apiCompare() },
    [`GET ${R}/compare/main...${OLD_HEAD}`]: { body: apiCompare() },
    [`GET ${R}/compare/main...${"e".repeat(40)}`]: apiErrors.notFound,
    ...over,
  };
}

const client = (routes: Record<string, Route>, sleep = vi.fn(async () => {})) => {
  const fake = createFakeFetch(routes);
  return {
    c: createGitHubClient({ token: "tok-sintetico", fetch: fake.fetch, sleep }),
    fake,
    sleep,
  };
};

describe("cliente — cabeçalhos e paginação", () => {
  it("envia Accept, X-GitHub-Api-Version e Authorization em toda chamada", async () => {
    const { c, fake } = client(prRoutes());
    await buildPrSnapshot(c, 42);
    expect(fake.calls.length).toBeGreaterThan(5);
    for (const call of fake.calls) {
      expect(call.url.startsWith(API)).toBe(true);
      expect(call.headers.accept).toBe("application/vnd.github+json");
      expect(call.headers["x-github-api-version"]).toBe("2022-11-28");
      expect(call.headers.authorization).toBe("Bearer tok-sintetico");
    }
  });

  it("listas usam per_page=100 e seguem o Link rel=next até o fim", async () => {
    const page2 = `${API}${P}/commits?per_page=100&page=2`;
    const { c, fake } = client(
      prRoutes({
        [`GET ${P}/commits?per_page=100`]: {
          body: [{ sha: HEAD, commit: { message: "a" } }],
          headers: { link: `<${page2}>; rel="next", <${page2}>; rel="last"` },
        },
        [`GET ${P}/commits?per_page=100&page=2`]: {
          body: [{ sha: OLD_HEAD, commit: { message: "b" } }],
        },
      }),
    );
    const s = await buildPrSnapshot(c, 42);
    expect(s.commits.map((x) => x.sha)).toEqual([HEAD, OLD_HEAD]);
    expect(fake.calls.filter((x) => x.path === `${P}/commits`)).toHaveLength(2);
  });
});

describe("buildPrSnapshot", () => {
  it("monta o snapshot com autor, repo do head, rótulos, arquivos, reviews e comentários", async () => {
    const { c } = client(prRoutes());
    const s = await buildPrSnapshot(c, 42);
    expect(s).toMatchObject({
      number: 42,
      draft: false,
      merged: false,
      authorLogin: "dougueta",
      headRepoFullName: "dougueta/prumo",
      headSha: HEAD,
      headRef: "999-exemplo",
      baseRef: "main",
      labels: ["autor:claude", "iniciativa:0"],
      changedFiles: ["src/app/page.tsx", "specs/999-exemplo/spec.md"],
      specExists: true,
    });
    expect(s.commits[0].message).toBe(trailers.claude);
    expect(s.reviews[0].commit_id).toBe(OLD_HEAD);
    expect(s.reviewComments[0].pull_request_review_id).toBe(1);
    expect(s.issueComments[0].user?.login).toBe("prumo-revisor[bot]");
  });

  it("impressões para o head e para cada headSha de veredito (404 ⇒ null)", async () => {
    const { c } = client(prRoutes());
    const s = await buildPrSnapshot(c, 42);
    expect(Object.keys(s.fingerprints).sort()).toEqual([HEAD, OLD_HEAD, "e".repeat(40)].sort());
    expect(s.fingerprints[HEAD]).toMatch(/^[0-9a-f]{64}$/);
    expect(s.fingerprints[OLD_HEAD]).toBe(s.fingerprints[HEAD]);
    expect(s.fingerprints["e".repeat(40)]).toBeNull();
  });

  it("compare sem patch ⇒ impressão null", async () => {
    const { c } = client(
      prRoutes({ [`GET ${R}/compare/main...${HEAD}`]: { body: apiCompareNoPatch() } }),
    );
    expect((await buildPrSnapshot(c, 42)).fingerprints[HEAD]).toBeNull();
  });

  it("specExists = false quando contents responde 404", async () => {
    const { c } = client(
      prRoutes({ [`GET ${R}/contents/specs/999-exemplo/spec.md`]: apiErrors.notFound }),
    );
    expect((await buildPrSnapshot(c, 42)).specExists).toBe(false);
  });

  it("lê a spec no head do PR (ref=<head sha>)", async () => {
    const { c, fake } = client(prRoutes());
    await buildPrSnapshot(c, 42);
    const call = fake.calls.find((x) => x.path.includes("/contents/"));
    expect(call?.query).toBe(`?ref=${HEAD}`);
  });

  it("branch fora do padrão NNN-slug não consulta contents (specExists = false)", async () => {
    const { c, fake } = client(
      prRoutes({
        [`GET ${P}`]: {
          body: apiPull({
            head: { sha: HEAD, ref: "docs/x", repo: { full_name: "dougueta/prumo" } },
          }),
        },
      }),
    );
    expect((await buildPrSnapshot(c, 42)).specExists).toBe(false);
    expect(fake.calls.some((x) => x.path.includes("/contents/"))).toBe(false);
  });

  it("fork apagado: head.repo null ⇒ headRepoFullName null", async () => {
    const { c } = client(prRoutes({ [`GET ${P}`]: { body: apiDeletedForkPull() } }));
    expect((await buildPrSnapshot(c, 42)).headRepoFullName).toBeNull();
  });

  it("patch da constitution vem dos arquivos do PR", async () => {
    const files = [
      {
        filename: ".specify/memory/constitution.md",
        status: "modified",
        patch: "@@ -1 +1 @@\n-a\n+b",
      },
    ];
    const { c } = client(prRoutes({ [`GET ${P}/files`]: { body: files } }));
    expect((await buildPrSnapshot(c, 42)).constitutionPatch).toBe("@@ -1 +1 @@\n-a\n+b");
  });

  it("renomeação inclui o nome anterior em changedFiles", async () => {
    const files = [
      { filename: "src/a.ts", previous_filename: "src/review/a.ts", status: "renamed", patch: "" },
    ];
    const { c } = client(prRoutes({ [`GET ${P}/files`]: { body: files } }));
    expect((await buildPrSnapshot(c, 42)).changedFiles).toEqual(["src/a.ts", "src/review/a.ts"]);
  });

  it("merged_at preenchido ⇒ merged", async () => {
    const { c } = client(
      prRoutes({ [`GET ${P}`]: { body: apiPull({ merged_at: "2026-10-06T15:00:00Z" }) } }),
    );
    expect(await buildPrSnapshot(c, 42)).toMatchObject({
      merged: true,
      mergedAt: "2026-10-06T15:00:00Z",
    });
  });
});

describe("check runs e ci.yml", () => {
  it("listCheckRuns devolve nome, conclusão e app", async () => {
    const { c } = client({
      [`GET ${R}/commits/${HEAD}/check-runs`]: {
        body: apiCheckRuns([
          { name: "Testes unitários", conclusion: "success" },
          { name: "x", conclusion: null, slug: "outro" },
        ]),
      },
    });
    expect(await listCheckRuns(c, HEAD)).toEqual([
      { name: "Testes unitários", conclusion: "success", appSlug: "github-actions" },
      { name: "x", conclusion: null, appSlug: "outro" },
    ]);
  });

  it("readCiWorkflow lê o ci.yml com ref=main e devolve o YAML parseado", async () => {
    const { c, fake } = client({
      [`GET ${R}/contents/.github/workflows/ci.yml`]: {
        body: { content: b64("jobs:\n  unit:\n    name: Testes unitários\n") },
      },
    });
    expect(await readCiWorkflow(c)).toEqual({ jobs: { unit: { name: "Testes unitários" } } });
    expect(fake.calls[0].query).toBe("?ref=main");
  });

  it("ci.yml ausente ⇒ erro fatal", async () => {
    const { c } = client({ [`GET ${R}/contents/.github/workflows/ci.yml`]: apiErrors.notFound });
    await expect(readCiWorkflow(c)).rejects.toBeInstanceOf(GitHubApiError);
  });
});

describe("política de erro", () => {
  it("403 com limite de taxa: espera retry-after e tenta de novo uma vez", async () => {
    const { c, sleep } = client(
      prRoutes({ [`GET ${P}`]: [apiErrors.rateLimited, { body: apiPull() }] }),
    );
    await buildPrSnapshot(c, 42);
    expect(sleep).toHaveBeenCalledWith(1000);
  });

  it("429 persistente ⇒ erro 'limite de taxa da API do GitHub'", async () => {
    const { c, sleep } = client(prRoutes({ [`GET ${P}`]: apiErrors.tooMany }));
    await expect(buildPrSnapshot(c, 42)).rejects.toThrow("limite de taxa da API do GitHub");
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it("espera máxima de 60 s", async () => {
    const limited = { ...apiErrors.tooMany, headers: { "retry-after": "3600" } };
    const { c, sleep } = client(prRoutes({ [`GET ${P}`]: [limited, { body: apiPull() }] }));
    await buildPrSnapshot(c, 42);
    expect(sleep).toHaveBeenCalledWith(60_000);
  });

  it("403 sem cabeçalho de limite ⇒ acesso negado (sem nova tentativa)", async () => {
    const { c, sleep } = client(prRoutes({ [`GET ${P}`]: apiErrors.forbidden }));
    await expect(buildPrSnapshot(c, 42)).rejects.toThrow(
      `acesso negado à API do GitHub (GET ${P})`,
    );
    expect(sleep).not.toHaveBeenCalled();
  });

  it("5xx: uma nova tentativa após 2 s; persistindo, erro fatal", async () => {
    const ok = client(prRoutes({ [`GET ${P}`]: [apiErrors.serverError, { body: apiPull() }] }));
    await buildPrSnapshot(ok.c, 42);
    expect(ok.sleep).toHaveBeenCalledWith(2000);
    const bad = client(prRoutes({ [`GET ${P}`]: apiErrors.serverError }));
    await expect(buildPrSnapshot(bad.c, 42)).rejects.toBeInstanceOf(GitHubApiError);
  });

  it("422 ⇒ erro fatal com a mensagem do corpo", async () => {
    const { c } = client({ [`POST ${R}/statuses/${HEAD}`]: apiErrors.unprocessable });
    await expect(c.request("POST", `${R}/statuses/${HEAD}`, { body: {} })).rejects.toThrow(
      "Validation Failed",
    );
  });

  it("404 inesperado (PR) ⇒ erro fatal", async () => {
    const { c } = client({ [`GET ${P}`]: apiErrors.notFound });
    await expect(buildPrSnapshot(c, 42)).rejects.toMatchObject({ status: 404 });
  });
});
