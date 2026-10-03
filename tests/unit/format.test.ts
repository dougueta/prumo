import { describe, expect, it } from "vitest";
import { formatCents, formatDate, todayInSaoPaulo } from "@/lib/format";

describe("format (FR-021)", () => {
  it("formata centavos em BRL pt-BR", () => {
    expect(formatCents(123456).replace(/\s/g, " ")).toBe("R$ 1.234,56");
    expect(formatCents(-5).replace(/\s/g, " ")).toBe("-R$ 0,05");
  });

  it("rejeita valores não inteiros (Constitution III)", () => {
    expect(() => formatCents(10.5)).toThrow();
  });

  it("formata data de negócio YYYY-MM-DD sem deslocar o dia", () => {
    expect(formatDate("2026-10-02")).toBe("02/10/2026");
  });

  it("calcula 'hoje' no fuso de São Paulo", () => {
    // 02:30 UTC de 3/out = 23:30 de 2/out em São Paulo
    expect(todayInSaoPaulo(new Date("2026-10-03T02:30:00Z"))).toBe("2026-10-02");
  });
});
