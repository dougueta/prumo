import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runCli } from "@/synthetic/cli";

const silent = { log: () => {}, error: () => {} };

describe("CLI do gerador (FR-017, contracts/synthetic-cli.md)", () => {
  it("recusa produção com exit 2", () => {
    const errors: string[] = [];
    const io = { ...silent, error: (message: string) => errors.push(message) };
    expect(runCli([], { APP_ENV: "production" }, io)).toBe(2);
    expect(errors.join()).toMatch(/Recusado: o gerador não roda em produção/);
  });

  it("rejeita --months menor que 12 com exit 1", () => {
    expect(runCli(["--months", "11"], {}, silent)).toBe(1);
  });

  it("rejeita argumento desconhecido com exit 1", () => {
    expect(runCli(["--foo", "1"], {}, silent)).toBe(1);
  });

  it("gera json, csv e ofx no diretório de saída", () => {
    const out = mkdtempSync(path.join(tmpdir(), "prumo-synth-"));
    expect(runCli(["--seed", "42", "--out", out], {}, silent)).toBe(0);
    const files = readdirSync(out);
    expect(files).toContain("dataset.json");
    expect(files.filter((f) => f.endsWith(".csv"))).toHaveLength(5);
    expect(files.filter((f) => f.endsWith(".ofx"))).toHaveLength(5);
    expect(JSON.parse(readFileSync(path.join(out, "dataset.json"), "utf-8")).seed).toBe(42);
  });
});
