import { describe, expect, it } from "vitest";
import { formatAbsoluteDate, formatMoney, todayInSaoPaulo } from "@/lib/format";

// Casos da 001 (FR-021) mantidos sobre a API da 003 (formatCents/formatDate foram substituídas).
describe("format (FR-021 da 001)", () => {
  it("formata centavos em BRL pt-BR (saldo)", () => {
    expect(formatMoney(123456, { variant: "balance" }).replace(/\s/g, " ")).toBe("R$ 1.234,56");
    expect(formatMoney(-5, { variant: "balance" }).replace(/\s/g, " ")).toBe("\u2212R$ 0,05");
  });

  it("rejeita valores não inteiros (Constitution III)", () => {
    expect(() => formatMoney(10.5)).toThrow();
  });

  it("formata data de negócio YYYY-MM-DD sem deslocar o dia", () => {
    expect(formatAbsoluteDate("2026-10-02")).toBe("02/10/2026");
  });

  it("calcula 'hoje' no fuso de São Paulo", () => {
    // 02:30 UTC de 3/out = 23:30 de 2/out em São Paulo
    expect(todayInSaoPaulo(new Date("2026-10-03T02:30:00Z"))).toBe("2026-10-02");
  });
});
