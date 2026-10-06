import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ENV_NAMES } from "@/lib/env";

describe(".env.example (FR-004)", () => {
  const example = readFileSync(".env.example", "utf-8");
  const declared = new Set(
    example
      .split(/\r?\n/)
      .map((line) => line.match(/^#?\s*([A-Z][A-Z0-9_]+)=/)?.[1])
      .filter(Boolean),
  );

  it("documenta toda variável conhecida pelo schema", () => {
    for (const name of ENV_NAMES) expect(declared, name).toContain(name);
  });

  it("não contém valores de segredo preenchidos", () => {
    for (const line of example.split(/\r?\n/)) {
      const match = line.match(/^(SUPABASE_SECRET_KEY|PRODUCTION_GATE_PASSWORD)=(.*)$/);
      if (match) expect(match[2], match[1]).toBe("");
    }
  });
});
