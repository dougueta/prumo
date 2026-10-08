// T033 · contracts/review-cli.md §review:publish — comentário final do prumo-revisor (FR-017, FR-018).
import { describe, expect, it } from "vitest";
import type { Manifest } from "../../../src/review/bundle";
import { parseVerdict } from "../../../src/review/parse-verdict";
import { formatPublication } from "../../../src/review/publish-format";
import { HEAD, OLD_HEAD, verdictBody } from "./fixtures";

const manifest: Manifest = {
  pr: 7,
  headSha: HEAD,
  baseSha: "c".repeat(40),
  branch: "010-x",
  feature: "010-x",
  generatedAt: "2026-10-06T12:00:00.000Z",
  files: [
    { path: "diff.patch", sha256: "1".repeat(64) },
    { path: "spec/spec.md", sha256: "2".repeat(64) },
    { path: "spec/plan.md", sha256: "ausente" },
  ],
};

describe("formatPublication", () => {
  it("insere o marcador com head= e gera Insumos lidos a partir do manifest", () => {
    const r = formatPublication({ verdictText: verdictBody(), manifest, currentHead: HEAD });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.body.startsWith(`<!-- prumo:veredito v1 head=${HEAD} -->\n`)).toBe(true);
    expect(r.body.match(/<!-- prumo:veredito v1/g)).toHaveLength(1);
    const parsed = parseVerdict(r.body, "claude");
    expect(parsed.status).toBe("ok");
    if (parsed.status === "ok") {
      expect(parsed.verdict.inputsRead).toEqual(["diff.patch", "spec/spec.md", "spec/plan.md"]);
    }
    expect(r.body).toContain(`- diff.patch (sha256: ${"1".repeat(64)})`);
    expect(r.body).toContain("- spec/plan.md (ausente)");
  });

  it("substitui uma seção Insumos lidos escrita pelo revisor (não confia nela)", () => {
    const text = verdictBody({ inputs: ["conversa do PR", "histórico"] });
    const r = formatPublication({ verdictText: text, manifest, currentHead: HEAD });
    expect(r.ok && r.body).not.toContain("conversa do PR");
  });

  it("veredito fora do formato ⇒ exit 2 com os erros do parser", () => {
    const r = formatPublication({
      verdictText: verdictBody({ findings: [[1, "GRAVE"]] }),
      manifest,
      currentHead: HEAD,
    });
    expect(r).toEqual({ ok: false, exit: 2, errors: ["severidade inválida"] });
  });

  it("arquivo sem bloco de veredito ⇒ exit 2", () => {
    const r = formatPublication({ verdictText: "Achei tudo ótimo.", manifest, currentHead: HEAD });
    expect(r.ok === false && r.exit).toBe(2);
  });

  it("head do PR mudou desde o pacote ⇒ exit 4", () => {
    const r = formatPublication({ verdictText: verdictBody(), manifest, currentHead: OLD_HEAD });
    expect(r).toEqual({
      ok: false,
      exit: 4,
      errors: ["PR recebeu commits após o pacote — refaça /revisar-pr"],
    });
  });
});
