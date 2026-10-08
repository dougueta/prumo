// T066 · contracts/review-cli.md §gh:repo-settings — só squash, apagar branch após merge (FR-003).
import { describe, expect, it, vi } from "vitest";
import { REPO_SETTINGS, runRepoSettings } from "../../../scripts/review/repo-settings";
import { R, createFakeFetch } from "./fixtures/fake-fetch";

async function run(argv: string[] = []) {
  const fake = createFakeFetch({ [`PATCH ${R}`]: { body: {} } });
  const out: string[] = [];
  const code = await runRepoSettings({
    argv,
    fetch: fake.fetch,
    exec: vi.fn(async () => ({ code: 0, stdout: "tok\n" })),
    sleep: async () => {},
    log: (m) => out.push(m),
  });
  return { code, calls: fake.calls, out: out.join("\n") };
}

describe("runRepoSettings (npm run gh:repo-settings)", () => {
  it("corpo do PATCH igual ao schema do contrato", () => {
    expect(REPO_SETTINGS).toEqual({
      allow_squash_merge: true,
      allow_merge_commit: false,
      allow_rebase_merge: false,
      delete_branch_on_merge: true,
      allow_update_branch: true,
    });
  });

  it("aplica com PATCH /repos/dougueta/prumo", async () => {
    const { code, calls } = await run();
    expect(code).toBe(0);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ method: "PATCH", path: R, body: REPO_SETTINGS });
  });

  it("--dry-run não escreve", async () => {
    const { code, calls, out } = await run(["--dry-run"]);
    expect(code).toBe(0);
    expect(calls).toEqual([]);
    expect(out).toContain("allow_squash_merge");
  });
});
