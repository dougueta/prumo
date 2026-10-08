import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { formatMoney, moneyToSpeech } from "@/lib/format";

/** data-model §5 — FR-025, FR-026, FR-028 (Constitution III). NBSP = U+00A0; − = U+2212. */
const NBSP = "\u00a0";
const MINUS = "\u2212";
const brl = (text: string) => text.replaceAll(" ", NBSP);

describe("formatMoney", () => {
  it.each([
    [123456, `+${brl("R$ 1.234,56")}`],
    [-4590, `${MINUS}${brl("R$ 45,90")}`],
    [0, brl("R$ 0,00")],
    [1, `+${brl("R$ 0,01")}`],
    [-1, `${MINUS}${brl("R$ 0,01")}`],
    [99, `+${brl("R$ 0,99")}`],
  ])("movimentação: %i → %s", (cents, expected) => {
    expect(formatMoney(cents)).toBe(expected);
    expect(formatMoney(cents, { variant: "movement" })).toBe(expected);
  });

  it.each([
    [123456, brl("R$ 1.234,56")],
    [-4590, `${MINUS}${brl("R$ 45,90")}`],
    [0, brl("R$ 0,00")],
  ])("saldo: %i → %s", (cents, expected) => {
    expect(formatMoney(cents, { variant: "balance" })).toBe(expected);
  });

  it("neutra nunca tem sinal", () => {
    expect(formatMoney(-4590, { variant: "neutral" })).toBe(brl("R$ 45,90"));
    expect(formatMoney(4590, { variant: "neutral" })).toBe(brl("R$ 45,90"));
  });

  it.each([
    [1234500, brl("R$ 12,3 mil")],
    [123400000, brl("R$ 1,2 mi")],
    [100000000000, brl("R$ 1 bi")],
    [-1234500, `${MINUS}${brl("R$ 12,3 mil")}`],
  ])("compacta: %i → %s", (cents, expected) => {
    expect(formatMoney(cents, { variant: "compact" })).toBe(expected);
  });

  it("moeda diferente de BRL mantém separadores pt-BR", () => {
    expect(formatMoney(1000, { currency: "USD" })).toBe(`+${brl("US$ 10,00")}`);
  });

  it("valor ausente vira travessão", () => {
    expect(formatMoney(null)).toBe("—");
    expect(formatMoney(null, { variant: "compact" })).toBe("—");
  });

  it("valores grandes não perdem precisão", () => {
    expect(formatMoney(999_999_999_999_99, { variant: "balance" })).toBe(
      brl("R$ 999.999.999.999,99"),
    );
    expect(formatMoney(Number.MAX_SAFE_INTEGER, { variant: "balance" })).toBe(
      brl("R$ 90.071.992.547.409,91"),
    );
  });

  it.each([10.5, Number.NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    "rejeita valor não inteiro ou inseguro: %s",
    (cents) => {
      expect(() => formatMoney(cents)).toThrow(TypeError);
    },
  );

  it("o código de formatação não divide centavos por 100 (sem float)", () => {
    const source = readFileSync(path.resolve(__dirname, "../../src/lib/format.ts"), "utf8");
    // (abs - frac) / 100 é divisão exata de inteiros; proibido é dividir o valor bruto.
    expect(source).not.toMatch(/\bcents\s*\/\s*100\b/);
  });
});

describe("moneyToSpeech", () => {
  it.each([
    [-4590, "movement", "saída de 45 reais e 90 centavos"],
    [100, "movement", "entrada de 1 real"],
    [1, "movement", "entrada de 1 centavo"],
    [123456, "movement", "entrada de 1234 reais e 56 centavos"],
    [-4590, "balance", "saldo negativo de 45 reais e 90 centavos"],
    [4590, "balance", "45 reais e 90 centavos"],
    [-4590, "neutral", "45 reais e 90 centavos"],
    [0, "movement", "zero reais"],
    [-1234500, "compact", "saldo negativo de 12345 reais"],
  ] as const)("%i (%s) → %s", (cents, variant, expected) => {
    expect(moneyToSpeech(cents, { variant })).toBe(expected);
  });

  it("valor ausente é anunciado como indisponível", () => {
    expect(moneyToSpeech(null)).toBe("valor indisponível");
  });

  it("outras moedas são lidas por extenso pelo Intl", () => {
    expect(moneyToSpeech(1050, { currency: "USD" }).toLowerCase()).toMatch(/^entrada de .*dólares/);
  });
});
