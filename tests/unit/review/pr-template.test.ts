// T070 · FR-021, FR-024 — modelo de PR.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseResponses } from "../../../src/review/parse-responses";
import { issueComment } from "./fixtures";

const text = () =>
  readFileSync(
    path.resolve(__dirname, "../../../.github/pull_request_template.md"),
    "utf8",
  ).replace(/\r\n/g, "\n");

describe(".github/pull_request_template.md", () => {
  it.each([
    "Feature",
    "Artefatos",
    "Tipo",
    "Rótulos",
    "Checklist do autor",
    "Respostas aos achados",
  ])("tem a seção %s", (s) => {
    expect(text()).toMatch(new RegExp(`^## ${s}`, "m"));
  });

  it("Feature no formato NNN · Nome e links para spec/plan/tasks", () => {
    expect(text()).toContain("NNN · Nome");
    for (const f of ["spec.md", "plan.md", "tasks.md"])
      expect(text()).toContain(`specs/NNN-slug/${f}`);
  });

  it("Tipo feature · processo · emenda; rótulos autor:* e iniciativa:N", () => {
    for (const t of ["feature", "processo", "emenda"]) expect(text()).toContain(t);
    for (const l of ["autor:claude", "autor:gemini", "autor:doug", "iniciativa:N"]) {
      expect(text()).toContain(l);
    }
  });

  it("checklist do autor com os 5 itens + espelho + gh:ruleset", () => {
    const items = [...text().matchAll(/^- \[ \] (.+)$/gm)].map((m) => m[1]).join("\n");
    for (const s of [
      "Testes escritos antes da implementação",
      "Verificações automáticas verdes",
      "Sem segredo nem dado real",
      "Rebase na `main`",
      "Todos os FRs cobertos",
      "espelho dos workflows atualizado",
      "`gh:ruleset` reexecutado se mudou job do CI",
    ]) {
      expect(items).toContain(s);
    }
  });

  it("emergência: campo 'Motivo da emergência:'", () => {
    expect(text()).toContain("Motivo da emergência:");
  });

  it("Respostas aos achados: explica que vai em comentário e traz exemplo aceito por parseResponses", () => {
    const section = text().slice(text().indexOf("## Respostas aos achados"));
    expect(section).toMatch(/comentário/);
    const block = /```markdown\n(<!-- prumo:respostas v1 -->[\s\S]*?)```/.exec(section)![1];
    const r = parseResponses(issueComment({ id: 1, at: "2026-10-06T12:00:00Z", body: block }));
    expect(r?.lines.length).toBeGreaterThan(0);
  });
});
