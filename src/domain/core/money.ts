import { validation } from "./errors";
import type { Cents } from "./types";

/**
 * Dinheiro é exato (Constitution III, research R-14): centavos inteiros seguros. Proibido
 * parseFloat/Number("12.34")*100 para dinheiro.
 */

export function isCents(value: unknown): value is Cents {
  return typeof value === "number" && Number.isSafeInteger(value);
}

/** Garante centavos inteiros seguros; senão CoreError("validation", field). */
export function assertCents(value: unknown, field = "amountCents"): Cents {
  if (!isCents(value)) throw validation(field);
  return value;
}

const PT_BR_DECIMAL = /^(-)?(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/;

/**
 * Converte valor monetário em centavos sem arredondar: texto pt-BR em reais ("1.234,56",
 * "-12,34", "0") ou número já em centavos (inteiro). Fração de centavo ⇒ erro (FR-018).
 */
export function parseCentsStrict(input: unknown, field = "amountCents"): Cents {
  if (typeof input === "number") return assertCents(input, field);
  if (typeof input !== "string") throw validation(field);
  const match = input.trim().match(PT_BR_DECIMAL);
  if (!match) throw validation(field);
  const [, sign, integerPart, fraction = ""] = match;
  const digits = integerPart.replaceAll(".", "") + fraction.padEnd(2, "0");
  const cents = Number(digits);
  if (!Number.isSafeInteger(cents)) throw validation(field);
  return sign && cents !== 0 ? -cents : cents;
}

/** Soma centavos validando cada parcela e o total. */
export function sumCents(values: Iterable<unknown>): Cents {
  let total = 0;
  for (const value of values) total += assertCents(value);
  return assertCents(total);
}
