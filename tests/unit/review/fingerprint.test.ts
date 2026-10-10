// T060 · data-model §2.1 — impressão do conteúdo do PR para o rebase neutro (FR-007).
import { describe, expect, it } from "vitest";
import { patchFingerprint } from "../../../src/review/fingerprint";
import type { CompareFile } from "../../../src/review/types";

const files: CompareFile[] = [
  { filename: "src/a.ts", status: "modified", patch: "@@ -10,3 +10,3 @@ fn\n ctx\n-old\n+new" },
  { filename: "src/b.ts", status: "added", patch: "@@ -0,0 +1,2 @@\n+x\n+y" },
];

describe("patchFingerprint", () => {
  it("é um sha256 hex", () => {
    expect(patchFingerprint(files)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("ignora os números dos cabeçalhos de hunk (rebase que só desloca linhas)", () => {
    const moved = files.map((f) => ({
      ...f,
      patch: f.patch!.replace("-10,3 +10,3", "-52,3 +57,3"),
    }));
    expect(patchFingerprint(moved)).toBe(patchFingerprint(files));
  });

  it("independe da ordem dos arquivos", () => {
    expect(patchFingerprint([...files].reverse())).toBe(patchFingerprint(files));
  });

  it("muda quando muda uma linha + ou -", () => {
    const changed = [{ ...files[0], patch: files[0].patch!.replace("+new", "+newer") }, files[1]];
    expect(patchFingerprint(changed)).not.toBe(patchFingerprint(files));
  });

  it("muda quando muda o contexto (conservador)", () => {
    const changed = [{ ...files[0], patch: files[0].patch!.replace(" ctx", " ctx2") }, files[1]];
    expect(patchFingerprint(changed)).not.toBe(patchFingerprint(files));
  });

  it("muda com status ou nome diferentes", () => {
    expect(patchFingerprint([{ ...files[0], status: "added" }, files[1]])).not.toBe(
      patchFingerprint(files),
    );
  });

  it("renomeação considera previous_filename", () => {
    const a = [{ ...files[0], status: "renamed", previous_filename: "src/old.ts" }];
    const b = [{ ...files[0], status: "renamed", previous_filename: "src/other.ts" }];
    expect(patchFingerprint(a)).not.toBe(patchFingerprint(b));
  });

  it("null quando algum arquivo não tem patch (binário/diff grande)", () => {
    expect(patchFingerprint([...files, { filename: "img.png", status: "added" }])).toBeNull();
  });

  it("null com 300 arquivos ou mais (limite do compare)", () => {
    const many = Array.from({ length: 300 }, (_, i) => ({
      filename: `f${i}.ts`,
      status: "added",
      patch: "@@ -0,0 +1 @@\n+x",
    }));
    expect(patchFingerprint(many)).toBeNull();
    expect(patchFingerprint(many.slice(0, 299))).not.toBeNull();
  });
});
