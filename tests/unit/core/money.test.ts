import { describe, expect, it } from "vitest";
import { assertCents, parseCentsStrict, sumCents } from "@/domain/core/money";
import { CoreError } from "@/domain/core/errors";

// 004 · T004 — FR-018: dinheiro só em centavos inteiros; nada de arredondamento silencioso.
describe("assertCents", () => {
  it("aceita inteiros seguros, inclusive zero e negativos", () => {
    expect(assertCents(0)).toBe(0);
    expect(assertCents(-12_345)).toBe(-12_345);
    expect(assertCents(Number.MAX_SAFE_INTEGER)).toBe(Number.MAX_SAFE_INTEGER);
  });

  it.each([1.5, Number.NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, "12", null, undefined])(
    "rejeita %s com erro de validação no campo",
    (value) => {
      expect(() => assertCents(value, "amountCents")).toThrow(CoreError);
      try {
        assertCents(value, "amountCents");
      } catch (error) {
        expect(error).toMatchObject({ code: "validation", field: "amountCents" });
      }
    },
  );
});

describe("parseCentsStrict", () => {
  it.each([
    ["12,34", 1234],
    ["-12,34", -1234],
    ["0", 0],
    ["0,5", 50],
    ["1.234,56", 123456],
    ["1234,56", 123456],
    ["  8,00 ", 800],
  ])("converte %s em %d centavos", (input, cents) => {
    expect(parseCentsStrict(input)).toBe(cents);
  });

  it("aceita número inteiro já em centavos (inclusive 0)", () => {
    expect(parseCentsStrict(0)).toBe(0);
    expect(parseCentsStrict(-800)).toBe(-800);
  });

  it.each(["12,345", "abc", "", "12.34.5", "1,2,3", Number.NaN, 1.5, null, undefined, {}])(
    "rejeita %s",
    (input) => {
      expect(() => parseCentsStrict(input)).toThrow(CoreError);
    },
  );
});

describe("sumCents", () => {
  it("soma inteiros e devolve 0 para lista vazia", () => {
    expect(sumCents([])).toBe(0);
    expect(sumCents([100, -50, 25])).toBe(75);
  });

  it("recusa parcela não inteira", () => {
    expect(() => sumCents([1, 0.5])).toThrow(CoreError);
  });
});
