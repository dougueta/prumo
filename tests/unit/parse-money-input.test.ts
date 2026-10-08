import { describe, expect, it } from "vitest";
import { parseMoneyInput } from "@/lib/format";

/** data-model §5 — FR-039: entrada pt-BR → centavos inteiros exatos, sempre positivos. */
describe("parseMoneyInput", () => {
  it.each([
    ["1234,5", 123450],
    ["1.234,50", 123450],
    ["R$ 1.234,50", 123450],
    ["R$\u00a01.234,50", 123450],
    ["1234,50", 123450],
    ["  1234,50  ", 123450],
    ["1.234", 123400],
    ["1.234.567", 123456700],
    ["12.5", 1250],
    ["0,01", 1],
    ["0,1", 10],
    ["10", 1000],
    ["999.999.999.999,99", 99999999999999],
  ])("%j → %i centavos", (text, cents) => {
    expect(parseMoneyInput(text)).toEqual({ ok: true, cents });
  });

  it.each([
    ["12,345", "Use no máximo 2 casas decimais."],
    ["abc", "Informe um valor."],
    ["", "Informe um valor."],
    ["   ", "Informe um valor."],
    ["R$", "Informe um valor."],
    ["1,2,3", "Informe um valor."],
    ["1.2.3", "Informe um valor."],
    ["-10", "Use o seletor Entrada/Saída para o sinal."],
    ["1.000.000.000.000,00", "Valor muito alto."],
    ["9999999999999", "Valor muito alto."],
  ])("%j → erro %j", (text, error) => {
    expect(parseMoneyInput(text)).toEqual({ ok: false, error });
  });

  it("devolve sempre inteiro seguro", () => {
    const result = parseMoneyInput("999.999.999.999,99");
    expect(result.ok && Number.isSafeInteger(result.cents)).toBe(true);
  });
});
