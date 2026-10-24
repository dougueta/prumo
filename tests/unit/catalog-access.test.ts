import { describe, expect, it } from "vitest";
import { isCatalogEnabled } from "@/lib/catalog-access";

/** FR-046 — catálogo só em local e preview; nunca em produção. */
describe("isCatalogEnabled", () => {
  it.each([
    ["local", true],
    ["preview", true],
    ["production", false],
  ] as const)("%s → %s", (env, expected) => {
    expect(isCatalogEnabled(env)).toBe(expected);
  });
});
