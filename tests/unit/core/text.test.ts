import { describe, expect, it } from "vitest";
import { nameKey, normalizeDescription } from "@/domain/core/text";

// 004 · T006 — FR-022 (identidade) e FR-032 (nome único sem acento/caixa).
describe("normalizeDescription", () => {
  it("remove diacríticos, coloca em maiúsculas e colapsa espaços", () => {
    expect(normalizeDescription("  Café   Grão  Fictício ")).toBe("CAFE GRAO FICTICIO");
    expect(normalizeDescription("pão\tde\nqueijo")).toBe("PAO DE QUEIJO");
  });

  it("é idempotente e preserva vazio", () => {
    expect(normalizeDescription("")).toBe("");
    const once = normalizeDescription("Ação Ótima");
    expect(normalizeDescription(once)).toBe(once);
  });
});

describe("nameKey", () => {
  it("ignora acento, caixa e espaços das pontas", () => {
    expect(nameKey("Alimentação ")).toBe("alimentacao");
    expect(nameKey("ALIMENTACAO")).toBe(nameKey("alimentação"));
  });
});
