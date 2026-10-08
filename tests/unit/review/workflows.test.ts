// T061 · contracts/review-gate.md + plan §Análise de ameaça — postura dos workflows da 002 com o
// repositório público (FR-001, FR-006, FR-024, FR-026).
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { CI_JOB_NAMES } from "./fixtures";

const root = path.resolve(__dirname, "../../..");
const read = (p: string) => readFileSync(path.resolve(root, p), "utf8");
const load = (p: string) => parse(read(p)) as Workflow;

interface Step {
  uses?: string;
  run?: string;
  with?: Record<string, unknown>;
  env?: Record<string, unknown>;
}
interface Job {
  name?: string;
  if?: string;
  needs?: string[] | string;
  permissions?: Record<string, string> | string;
  environment?: unknown;
  steps?: Step[];
}
interface Workflow {
  on: Record<string, unknown> | string | string[];
  permissions?: unknown;
  concurrency?: { group: string; "cancel-in-progress": boolean | string };
  jobs: Record<string, Job>;
}

const TEXTUAL_EVENT =
  /github\.event\.(pull_request\.(title|body|head\.ref|head\.label)|issue\.(title|body)|comment\.body|review\.body)/;

/** Problemas de segurança de um job (vale para todo job das automações da 002). */
function jobProblems(id: string, job: Job): string[] {
  const out: string[] = [];
  const text = JSON.stringify(job);
  for (const m of text.matchAll(/secrets\.([A-Za-z_]+)/g)) {
    if (m[1] !== "GITHUB_TOKEN") out.push(`${id}: usa secrets.${m[1]}`);
  }
  if (job.environment !== undefined) out.push(`${id}: usa environment`);
  if (TEXTUAL_EVENT.test(text)) out.push(`${id}: referencia texto do evento`);
  if (typeof job.permissions !== "object") out.push(`${id}: sem permissões explícitas por job`);
  for (const step of job.steps ?? []) {
    if (step.uses?.startsWith("actions/checkout")) {
      const w = step.with ?? {};
      if (w.ref !== "main") out.push(`${id}: checkout sem ref: main`);
      if (w["persist-credentials"] !== false) out.push(`${id}: checkout persiste credenciais`);
    }
    if (step.run && step.run.includes("${{")) out.push(`${id}: expressão interpolada em run:`);
  }
  return out;
}

/** Problemas de um workflow inteiro da 002 (review-gate.yml, main-guard.yml). */
function workflowProblems(wf: Workflow): string[] {
  const out: string[] = [];
  const triggers = Array.isArray(wf.on)
    ? wf.on
    : typeof wf.on === "string"
      ? [wf.on]
      : Object.keys(wf.on);
  if (triggers.includes("pull_request")) out.push("gatilho pull_request");
  if (!(
    typeof wf.permissions === "object" &&
    wf.permissions &&
    Object.keys(wf.permissions).length === 0
  )) {
    out.push("permissions: {} ausente no topo");
  }
  for (const [id, job] of Object.entries(wf.jobs)) out.push(...jobProblems(id, job));
  return out;
}

describe("verificador de postura reprova workflows inseguros (fixtures)", () => {
  it.each([
    ["insecure-pull-request.yml", "gatilho pull_request"],
    ["insecure-checkout-head.yml", "checkout sem ref: main"],
    ["insecure-secret.yml", "usa secrets.SUPABASE_ACCESS_TOKEN"],
    ["insecure-secret.yml", "usa environment"],
    ["insecure-injection.yml", "referencia texto do evento"],
    ["insecure-injection.yml", "expressão interpolada em run:"],
    ["insecure-permissions.yml", "permissions: {} ausente no topo"],
    ["insecure-permissions.yml", "checkout persiste credenciais"],
  ])("%s ⇒ %s", (file, problem) => {
    const problems = workflowProblems(load(`tests/unit/review/fixtures/workflows/${file}`));
    expect(problems.join("\n")).toContain(problem);
  });
});

describe("review-gate.yml", () => {
  const wf = () => load(".github/workflows/review-gate.yml");

  it("passa no verificador de postura", () => {
    expect(workflowProblems(wf())).toEqual([]);
  });

  it("gatilhos exatos do contrato", () => {
    const on = wf().on as Record<string, { types?: string[]; inputs?: Record<string, unknown> }>;
    expect(Object.keys(on).sort()).toEqual(
      ["issue_comment", "pull_request_review", "pull_request_target", "workflow_dispatch"].sort(),
    );
    expect(on.pull_request_target.types).toEqual([
      "opened",
      "reopened",
      "synchronize",
      "edited",
      "labeled",
      "unlabeled",
      "ready_for_review",
      "converted_to_draft",
    ]);
    expect(on.issue_comment.types).toEqual(["created", "edited", "deleted"]);
    expect(on.pull_request_review.types).toEqual(["submitted", "edited", "dismissed"]);
    expect(Object.keys(on.workflow_dispatch.inputs ?? {})).toEqual(["pr"]);
  });

  it("concurrency por PR com cancel-in-progress", () => {
    const c = wf().concurrency!;
    expect(c.group).toMatch(/^review-gate-\$\{\{.*number.*\}\}$/);
    expect(c["cancel-in-progress"]).toBe(true);
  });

  it("job gate: permissões do contrato, roda só o número do PR via env", () => {
    const gate = wf().jobs.gate;
    expect(gate.permissions).toEqual({
      contents: "read",
      "pull-requests": "write",
      issues: "write",
      statuses: "write",
      checks: "read",
    });
    expect(gate.if).toMatch(/pull_request_review/);
    const run = gate.steps!.find((s) => s.run?.includes("review:gate"))!;
    expect(Object.keys(run.env ?? {}).sort()).toEqual(["GITHUB_TOKEN", "PR_NUMBER", "RUN_ID"]);
    expect(String(run.env!.PR_NUMBER)).toMatch(/number|inputs\.pr/);
    expect(String(run.env!.PR_NUMBER)).not.toMatch(TEXTUAL_EVENT);
  });

  it("job redispatch: só actions: write, sem checkout, dispara o workflow na main", () => {
    const job = wf().jobs.redispatch;
    expect(job.permissions).toEqual({ actions: "write" });
    expect(job.if).toBe("github.event_name == 'pull_request_review'");
    expect(job.steps!.some((s) => s.uses?.startsWith("actions/checkout"))).toBe(false);
    const run = job.steps!.map((s) => s.run ?? "").join("\n");
    expect(run).toMatch(/gh workflow run review-gate\.yml .*--ref main .*-f pr=/);
  });
});

describe("ci.yml — job main-guard", () => {
  const wf = () => load(".github/workflows/ci.yml");

  it("job main-guard (Guarda da main) só em push na main, com postura segura", () => {
    const job = wf().jobs["main-guard"];
    expect(job.name).toBe("Guarda da main");
    expect(job.if).toBe("github.event_name == 'push' && github.ref == 'refs/heads/main'");
    expect(job.permissions).toEqual({
      contents: "read",
      "pull-requests": "read",
      issues: "write",
      checks: "read",
    });
    expect(jobProblems("main-guard", job)).toEqual([]);
  });

  it("deploy-db depende do main-guard", () => {
    const needs = wf().jobs["deploy-db"].needs;
    expect(Array.isArray(needs) ? needs : [needs]).toContain("main-guard");
  });

  it("nomes dos jobs de PR preservados", () => {
    const names = Object.values(wf().jobs).map((j) => j.name);
    for (const n of CI_JOB_NAMES) expect(names).toContain(n);
  });
});

describe("main-guard.yml", () => {
  const wf = () => load(".github/workflows/main-guard.yml");

  it("passa no verificador de postura", () => {
    expect(workflowProblems(wf())).toEqual([]);
  });

  it("só schedule (11:00 UTC) + workflow_dispatch", () => {
    const on = wf().on as Record<string, unknown>;
    expect(Object.keys(on).sort()).toEqual(["schedule", "workflow_dispatch"]);
    expect(on.schedule).toEqual([{ cron: "0 11 * * *" }]);
  });

  it("permissões mínimas por job", () => {
    for (const job of Object.values(wf().jobs)) {
      expect(job.permissions).toEqual({
        contents: "read",
        issues: "write",
        "pull-requests": "read",
      });
    }
  });
});
