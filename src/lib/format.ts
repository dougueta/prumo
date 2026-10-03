export const LOCALE = "pt-BR";
export const TIME_ZONE = "America/Sao_Paulo";

const currency = new Intl.NumberFormat(LOCALE, { style: "currency", currency: "BRL" });

/** Formata valor em centavos inteiros (Constitution III). */
export function formatCents(cents: number): string {
  if (!Number.isInteger(cents)) throw new TypeError("Valor monetário deve ser inteiro em centavos");
  return currency.format(cents / 100);
}

/** Formata data de negócio `YYYY-MM-DD` como `DD/MM/AAAA`, sem conversão de fuso. */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

/** Data de hoje (`YYYY-MM-DD`) no fuso de São Paulo. */
export function todayInSaoPaulo(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(now);
}
