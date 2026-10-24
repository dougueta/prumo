import type { IsoDate } from "./types";

/** Datas de negócio: "YYYY-MM-DD" no fuso America/Sao_Paulo (Constitution III, R-14). */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
export const MIN_DATE = "1900-01-01";
export const MAX_DATE = "2100-12-31";

export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== "string") return false;
  const match = value.match(ISO_DATE);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  if (month < 1 || month > 12 || day < 1) return false;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day > daysInMonth) return false;
  return value >= MIN_DATE && value <= MAX_DATE;
}

const SAO_PAULO = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Data (São Paulo) de um instante: "2026-10-01T02:30:00Z" → "2026-09-30". */
export function toSaoPauloDate(instant: string | Date): IsoDate {
  const date = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(date.getTime())) throw new RangeError("Instante inválido.");
  return SAO_PAULO.format(date);
}

export function todayInSaoPaulo(now: () => Date = () => new Date()): IsoDate {
  return toSaoPauloDate(now());
}

/** Instante ISO-8601 com fuso explícito (Z ou ±hh:mm). */
export function isInstant(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:\d{2})$/.test(value) &&
    !Number.isNaN(new Date(value).getTime())
  );
}
