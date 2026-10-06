import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runCli } from "@/synthetic/cli";

const FIXTURES = "tests/fixtures/synthetic";

describe("fixtures sintéticos versionados (T040)", () => {
  it("são idênticos ao que o gerador produz hoje (rode `npm run synthetic` se falhar)", () => {
    const out = mkdtempSync(path.join(tmpdir(), "prumo-fixtures-"));
    expect(runCli(["--out", out], {}, { log: () => {}, error: () => {} })).toBe(0);
    const generated = readdirSync(out).sort();
    expect(readdirSync(FIXTURES).sort()).toEqual(generated);
    for (const file of generated) {
      expect(
        readFileSync(path.join(FIXTURES, file)).equals(readFileSync(path.join(out, file))),
        file,
      ).toBe(true);
    }
  });
});
