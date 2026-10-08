// Feature 002 · contracts/github-api.openapi.yaml — cliente mínimo da API do GitHub
// (fetch injetável, política de erro comum, paginação por Link) e montador de PrSnapshot.
import { parse } from "yaml";
import {
  CI_WORKFLOW_PATH,
  CONSTITUTION_PATH,
  REPO_FULL_NAME,
  REVIEWER_IDENTITY,
  VERDICT_MARKER,
} from "../../src/review/catalog";
import { isFeatureBranch } from "../../src/review/classify-pr";
import { patchFingerprint } from "../../src/review/fingerprint";
import type {
  CheckRunInfo,
  CompareFile,
  PrSnapshot,
  RawIssueComment,
  RawReview,
  RawReviewComment,
  RawUser,
} from "../../src/review/types";

export const API_BASE = "https://api.github.com";
export const REPO_PATH = `/repos/${REPO_FULL_NAME}`;
const MAX_WAIT_MS = 60_000;
const SERVER_RETRY_MS = 2_000;

export type Sleep = (ms: number) => Promise<void>;
export const realSleep: Sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export type ApiErrorKind = "access" | "rate" | "notFound" | "unprocessable" | "server" | "other";
export class GitHubApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly kind: ApiErrorKind,
  ) {
    super(message);
    this.name = "GitHubApiError";
  }
}

export interface ApiResponse<T> {
  status: number;
  data: T;
  headers: Headers;
}

export interface RequestOptions {
  body?: unknown;
  query?: Record<string, string>;
  /** 404 vira `null` em vez de erro (operações em que 404 é resposta esperada). */
  allow404?: boolean;
}

export interface GitHubClient {
  request<T = unknown>(
    method: string,
    path: string,
    opts?: RequestOptions,
  ): Promise<ApiResponse<T>>;
  /** GET que devolve null em 404. */
  getOptional<T = unknown>(path: string, query?: Record<string, string>): Promise<T | null>;
  /** GET paginado (per_page=100, segue Link rel="next"). */
  paginate<T = unknown>(path: string, query?: Record<string, string>): Promise<T[]>;
}

export interface ClientOptions {
  token: string;
  fetch?: typeof fetch;
  sleep?: Sleep;
}

function waitFor(headers: Headers, now: number): number {
  const retryAfter = headers.get("retry-after");
  if (retryAfter && /^\d+$/.test(retryAfter))
    return Math.min(Number(retryAfter) * 1000, MAX_WAIT_MS);
  const reset = headers.get("x-ratelimit-reset");
  if (reset && /^\d+$/.test(reset)) {
    return Math.min(Math.max(Number(reset) * 1000 - now, 1000), MAX_WAIT_MS);
  }
  return MAX_WAIT_MS;
}

const isRateLimited = (status: number, headers: Headers) =>
  (status === 403 || status === 429) &&
  (headers.get("x-ratelimit-remaining") === "0" || headers.has("retry-after"));

export function createGitHubClient(opts: ClientOptions): GitHubClient {
  const doFetch = opts.fetch ?? fetch;
  const sleep = opts.sleep ?? realSleep;

  async function raw(method: string, url: string, body?: unknown, allow404 = false) {
    const route = `${method} ${new URL(url).pathname}`;
    let retried = false;
    for (;;) {
      const res = await doFetch(url, {
        method,
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          Authorization: `Bearer ${opts.token}`,
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      if (res.ok) {
        const text = res.status === 204 ? "" : await res.text();
        return { status: res.status, data: text ? JSON.parse(text) : null, headers: res.headers };
      }
      const payload = (await res.json().catch(() => ({}))) as { message?: string };
      if (isRateLimited(res.status, res.headers)) {
        if (!retried) {
          retried = true;
          await sleep(waitFor(res.headers, Date.now()));
          continue;
        }
        throw new GitHubApiError("limite de taxa da API do GitHub", res.status, "rate");
      }
      if (res.status >= 500) {
        if (!retried) {
          retried = true;
          await sleep(SERVER_RETRY_MS);
          continue;
        }
        throw new GitHubApiError(
          `erro ${res.status} da API do GitHub (${route})`,
          res.status,
          "server",
        );
      }
      if (res.status === 404 && allow404) return null;
      if (res.status === 401 || res.status === 403) {
        throw new GitHubApiError(`acesso negado à API do GitHub (${route})`, res.status, "access");
      }
      if (res.status === 404) {
        throw new GitHubApiError(`não encontrado na API do GitHub (${route})`, 404, "notFound");
      }
      if (res.status === 422) {
        throw new GitHubApiError(
          payload.message ?? "requisição inválida (422)",
          422,
          "unprocessable",
        );
      }
      throw new GitHubApiError(
        `erro ${res.status} da API do GitHub (${route})`,
        res.status,
        "other",
      );
    }
  }

  const url = (path: string, query?: Record<string, string>) => {
    const u = new URL(path, API_BASE);
    for (const [k, v] of Object.entries(query ?? {})) u.searchParams.set(k, v);
    return u.toString();
  };

  return {
    async request<T>(method: string, path: string, o: RequestOptions = {}) {
      const r = await raw(method, url(path, o.query), o.body, o.allow404);
      if (r === null) return { status: 404, data: null as T, headers: new Headers() };
      return r as ApiResponse<T>;
    },
    async getOptional<T>(path: string, query?: Record<string, string>) {
      const r = await raw("GET", url(path, query), undefined, true);
      return r === null ? null : (r.data as T);
    },
    async paginate<T>(path: string, query: Record<string, string> = {}) {
      const out: T[] = [];
      let next: string | null = url(path, { per_page: "100", ...query });
      while (next) {
        const r = await raw("GET", next);
        out.push(...((r!.data as T[]) ?? []));
        const link = r!.headers.get("link") ?? "";
        next = /<([^>]+)>;\s*rel="next"/.exec(link)?.[1] ?? null;
      }
      return out;
    },
  };
}

// ---------- token ----------

export type Exec = (cmd: string, args: string[]) => Promise<{ code: number; stdout: string }>;

/** Token do `gh auth token` (Doug, local). Nunca impresso. */
export async function ghToken(exec: Exec): Promise<string> {
  const r = await exec("gh", ["auth", "token"]);
  const token = r.stdout.trim();
  if (r.code !== 0 || !token)
    throw new Error("não foi possível obter o token do gh (rode gh auth login)");
  return token;
}

// ---------- leituras de alto nível ----------

interface ApiPull {
  number: number;
  draft: boolean;
  state: string;
  merged_at: string | null;
  merge_commit_sha: string | null;
  body: string | null;
  user: { login: string } | null;
  head: { sha: string; ref: string; repo: { full_name: string } | null };
  base: { sha: string; ref: string };
  labels: { name: string }[];
}

export const getPull = (c: GitHubClient, n: number) =>
  c.request<ApiPull>("GET", `${REPO_PATH}/pulls/${n}`).then((r) => r.data);

const decodeContent = (data: { content?: string } | null) =>
  Buffer.from(data?.content ?? "", "base64").toString("utf8");

/** Conteúdo de um arquivo num ref, ou null se não existir. */
export async function readFileAt(
  c: GitHubClient,
  path: string,
  ref: string,
): Promise<string | null> {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  const data = await c.getOptional<{ content?: string }>(`${REPO_PATH}/contents/${encoded}`, {
    ref,
  });
  return data === null ? null : decodeContent(data);
}

/** `.github/workflows/ci.yml` parseado, lido no ref indicado (padrão: main). Ausente ⇒ erro. */
export async function readCiWorkflow(c: GitHubClient, ref = "main"): Promise<unknown> {
  const text = await readFileAt(c, CI_WORKFLOW_PATH, ref);
  if (text === null) throw new GitHubApiError("ci.yml não encontrado", 404, "notFound");
  return parse(text);
}

export async function listCheckRuns(c: GitHubClient, ref: string): Promise<CheckRunInfo[]> {
  const r = await c.request<{
    check_runs: { name: string; conclusion: string | null; app: { slug: string } }[];
  }>("GET", `${REPO_PATH}/commits/${ref}/check-runs`, { query: { per_page: "100" } });
  return r.data.check_runs.map((x) => ({
    name: x.name,
    conclusion: x.conclusion,
    appSlug: x.app.slug,
  }));
}

interface ApiCompare {
  behind_by: number;
  ahead_by: number;
  files?: CompareFile[];
}

export async function compare(
  c: GitHubClient,
  base: string,
  head: string,
): Promise<ApiCompare | null> {
  return c.getOptional<ApiCompare>(`${REPO_PATH}/compare/${base}...${head}`);
}

/** Impressão do conteúdo do PR naquele sha (null se não comprovável ou sha inacessível). */
export async function fingerprintAt(
  c: GitHubClient,
  base: string,
  sha: string,
): Promise<string | null> {
  const cmp = await compare(c, base, sha);
  return cmp ? patchFingerprint(cmp.files ?? []) : null;
}

/** shas de head citados por possíveis vereditos (para calcular as impressões). */
function verdictHeads(reviews: RawReview[], comments: RawIssueComment[]): string[] {
  const out = new Set<string>();
  const isBot = (u: RawUser | null, who: "gemini" | "claude") =>
    u?.login === REVIEWER_IDENTITY[who].login && u?.type === REVIEWER_IDENTITY[who].type;
  for (const r of reviews) {
    if (isBot(r.user, "gemini") && (r.body ?? "").includes(VERDICT_MARKER)) out.add(r.commit_id);
  }
  // Só o bot do revisor Claude publica head= — comentários de outras contas não geram compare.
  for (const cm of comments) {
    if (!isBot(cm.user, "claude")) continue;
    const m = /<!-- prumo:veredito v1\s+head=([0-9a-f]{40})/.exec(cm.body ?? "");
    if (m) out.add(m[1]);
  }
  return [...out];
}

export async function buildPrSnapshot(c: GitHubClient, n: number): Promise<PrSnapshot> {
  const pull = await getPull(c, n);
  const base = `${REPO_PATH}/pulls/${n}`;
  const [commits, files, reviews, reviewComments, issueComments] = await Promise.all([
    c.paginate<{ sha: string; commit: { message: string } }>(`${base}/commits`),
    c.paginate<CompareFile>(`${base}/files`),
    c.paginate<RawReview>(`${base}/reviews`),
    c.paginate<RawReviewComment>(`${base}/comments`),
    c.paginate<RawIssueComment>(`${REPO_PATH}/issues/${n}/comments`),
  ]);
  const headSha = pull.head.sha;
  const headRef = pull.head.ref;
  const specExists = isFeatureBranch(headRef)
    ? (await readFileAt(c, `specs/${headRef}/spec.md`, headSha)) !== null
    : false;

  const fingerprints: Record<string, string | null> = {};
  for (const sha of [headSha, ...verdictHeads(reviews, issueComments)]) {
    if (!(sha in fingerprints)) fingerprints[sha] = await fingerprintAt(c, pull.base.ref, sha);
  }

  const changedFiles: string[] = [];
  for (const f of files) {
    changedFiles.push(f.filename);
    if (f.previous_filename) changedFiles.push(f.previous_filename);
  }
  const constitution = files.find((f) => f.filename === CONSTITUTION_PATH);

  return {
    number: pull.number,
    draft: pull.draft,
    merged: pull.merged_at !== null,
    ...(pull.merged_at ? { mergedAt: pull.merged_at } : {}),
    authorLogin: pull.user?.login ?? "",
    headRepoFullName: pull.head.repo?.full_name ?? null,
    headSha,
    headRef,
    baseRef: pull.base.ref,
    body: pull.body ?? "",
    labels: pull.labels.map((l) => l.name),
    changedFiles,
    ...(constitution?.patch !== undefined ? { constitutionPatch: constitution.patch } : {}),
    commits: commits.map((x) => ({ sha: x.sha, message: x.commit.message })),
    specExists,
    fingerprints,
    reviews,
    reviewComments,
    issueComments,
  };
}
