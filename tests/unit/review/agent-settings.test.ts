// T065 · contracts/review-cli.md §Negação — configurações dos agentes (FR-004, FR-005, FR-009, FR-024).
// As regras por padrão de texto são contornáveis (risco residual no ADR 0007); o servidor (ruleset)
// e o pr:merge continuam exigindo as condições do FR-002.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../../..");
const json = (p: string) => JSON.parse(readFileSync(path.join(root, p), "utf8"));

/**
 * Casador no estilo do Claude Code: `Tool(padrão)`; `:*` no fim = prefixo; `*` = qualquer trecho.
 */
function claudeDenies(rules: string[], tool: string, input: string): boolean {
  return rules.some((rule) => {
    const m = /^(\w+)\((.*)\)$/.exec(rule);
    if (!m || m[1] !== tool) return false;
    let pattern = m[2];
    if (pattern.endsWith(":*")) pattern = `${pattern.slice(0, -2)}*`;
    const re = new RegExp(
      `^${pattern
        .split("*")
        .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
        .join(".*")}$`,
    );
    return re.test(input);
  });
}

/** Casador no estilo do Gemini CLI: `run_shell_command(prefixo)` casa por prefixo do comando. */
function geminiDenies(excluded: string[], command: string): boolean {
  return excluded.some((rule) => {
    const m = /^run_shell_command\((.*)\)$/.exec(rule);
    return m !== null && (command === m[1] || command.startsWith(`${m[1]} `));
  });
}

const DENIED = [
  "gh pr merge 42 --squash --delete-branch",
  "npm run pr:merge -- 42",
  "npm run review:publish -- 42",
  "npm run gh:ruleset",
  "gh api -X PUT repos/dougueta/prumo/pulls/42/merge",
  "gh api repos/dougueta/prumo/statuses/abc -f state=success",
  "gh api repos/dougueta/prumo/issues/42/labels -f labels[]=emergencia",
  "gh api -X POST repos/dougueta/prumo/rulesets --input r.json",
  "gh pr edit 42 --add-label emergencia",
  "gh repo edit --enable-merge-commit",
  "cat ~/.prumo/prumo-revisor.pem",
];
const ALLOWED = [
  "git push origin 002-revisor-pr",
  "git push --force-with-lease origin 002-revisor-pr",
  "gh pr create --draft --title x --label autor:claude",
  "npm run test:unit",
];

describe(".claude/settings.json — permissions.deny", () => {
  const deny: string[] = json(".claude/settings.json").permissions.deny;

  it.each(DENIED)("nega (Bash e PowerShell): %s", (cmd) => {
    expect(claudeDenies(deny, "Bash", cmd)).toBe(true);
    expect(claudeDenies(deny, "PowerShell", cmd)).toBe(true);
  });

  it.each(ALLOWED)("permite: %s", (cmd) => {
    expect(claudeDenies(deny, "Bash", cmd)).toBe(false);
    expect(claudeDenies(deny, "PowerShell", cmd)).toBe(false);
  });

  it("nega leitura de ~/.prumo/**", () => {
    expect(claudeDenies(deny, "Read", "~/.prumo/prumo-revisor.pem")).toBe(true);
  });

  it("mantém push direto na main como mensagem antecipada", () => {
    expect(claudeDenies(deny, "Bash", "git push origin main")).toBe(true);
    expect(claudeDenies(deny, "Bash", "git push origin HEAD:main")).toBe(true);
  });
});

describe(".gemini/settings.json — tools.exclude", () => {
  const settings = json(".gemini/settings.json");
  const excluded: string[] = settings.tools.exclude;

  it.each(DENIED)("nega: %s", (cmd) => {
    expect(geminiDenies(excluded, cmd)).toBe(true);
  });

  it.each(ALLOWED)("permite: %s", (cmd) => {
    expect(geminiDenies(excluded, cmd)).toBe(false);
  });

  it("shell interativo (PTY) desativado", () => {
    expect(settings.tools.shell.enableInteractiveShell).toBe(false);
  });
});
