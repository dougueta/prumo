// T008 · research R-06 — tipo do PR e GATE_SELF_PATHS (FR-012, FR-013, FR-024).
import { describe, expect, it } from "vitest";
import { GATE_SELF_PATHS, PROCESS_PATHS } from "../../../src/review/catalog";
import {
  classifyPr,
  isFeatureBranch,
  matchesPath,
  touchesGate,
} from "../../../src/review/classify-pr";

describe("matchesPath", () => {
  it("padrão /** casa o diretório recursivamente; demais são exatos", () => {
    expect(matchesPath("docs/**", "docs/adr/0001.md")).toBe(true);
    expect(matchesPath("docs/**", "docsx/a.md")).toBe(false);
    expect(matchesPath("README.md", "README.md")).toBe(true);
    expect(matchesPath("README.md", "src/README.md")).toBe(false);
  });
});

describe("classifyPr", () => {
  it("emenda quando altera a constitution (mesmo com outros arquivos)", () => {
    expect(classifyPr([".specify/memory/constitution.md", "src/a.ts"])).toBe("emenda");
  });

  it("processo quando todos os arquivos estão em PROCESS_PATHS", () => {
    const sample = [
      "docs/workflow.md",
      "AGENTS.md",
      "CLAUDE.md",
      "GEMINI.md",
      "README.md",
      ".specify/templates/x.md",
      ".gemini/styleguide.md",
      ".claude/settings.json",
      ".github/pull_request_template.md",
    ];
    expect(sample.length).toBe(PROCESS_PATHS.length);
    expect(classifyPr(sample)).toBe("processo");
  });

  it("feature quando há arquivo de produto, spec ou workflow", () => {
    expect(classifyPr(["docs/a.md", "src/app/page.tsx"])).toBe("feature");
    expect(classifyPr(["specs/004-x/spec.md"])).toBe("feature");
    expect(classifyPr([".github/workflows/ci.yml"])).toBe("feature");
  });

  it("lista vazia ⇒ processo (nada de produto alterado)", () => {
    expect(classifyPr([])).toBe("processo");
  });
});

describe("touchesGate", () => {
  const oneFilePer: Record<(typeof GATE_SELF_PATHS)[number], string> = {
    ".github/workflows/**": ".github/workflows/review-gate.yml",
    "scripts/review/**": "scripts/review/gate.ts",
    "src/review/**": "src/review/evaluate-gate.ts",
    "tests/unit/review/**": "tests/unit/review/__snapshots__/workflows.md",
    ".gemini/**": ".gemini/styleguide.md",
    ".claude/settings.json": ".claude/settings.json",
    ".claude/agents/revisor-limpo.md": ".claude/agents/revisor-limpo.md",
    ".claude/skills/revisar-pr/**": ".claude/skills/revisar-pr/SKILL.md",
    "docs/review-checklist.md": "docs/review-checklist.md",
    "package.json": "package.json",
    "package-lock.json": "package-lock.json",
  };

  it.each(Object.entries(oneFilePer))("%s ⇒ true (%s)", (_pattern, file) => {
    expect(touchesGate(["src/app/page.tsx", file])).toBe(true);
  });

  it("cobre todo item do catálogo", () => {
    expect(Object.keys(oneFilePer).sort()).toEqual([...GATE_SELF_PATHS].sort());
  });

  it("arquivos fora dos mecanismos de revisão ⇒ false", () => {
    expect(
      touchesGate(["src/app/page.tsx", "docs/workflow.md", ".claude/skills/speckit-plan/SKILL.md"]),
    ).toBe(false);
  });
});

describe("isFeatureBranch", () => {
  it("^\d{3}-[a-z0-9-]+$", () => {
    expect(isFeatureBranch("002-revisor-pr")).toBe(true);
    expect(isFeatureBranch("999-teste")).toBe(true);
    expect(isFeatureBranch("feature/x")).toBe(false);
    expect(isFeatureBranch("02-x")).toBe(false);
    expect(isFeatureBranch("002-Revisor")).toBe(false);
    expect(isFeatureBranch("002-x/../../etc")).toBe(false);
  });
});
