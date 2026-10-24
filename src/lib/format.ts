/**
 * Formatação pt-BR de valores e datas (spec 003, data-model §5; Constitution III).
 * Funções puras: servidor e cliente produzem o mesmo texto (sem divergência de hidratação).
 */
export const LOCALE = "pt-BR";
export const TIME_ZONE = "America/Sao_Paulo";

const MINUS = "−"; // sinal de menos tipográfico (U+2212)

export type MoneyVariant = "movement" | "balance" | "neutral" | "compact";
export type MoneyOptions = { variant?: MoneyVariant; currency?: string };

const formatters = new Map<string, Intl.NumberFormat>();

function formatter(currency: string, compact: boolean, name = false): Intl.NumberFormat {
  const key = `${currency}|${compact}|${name}`;
  let cached = formatters.get(key);
  if (!cached) {
    cached = new Intl.NumberFormat(LOCALE, {
      style: "currency",
      currency,
      ...(compact ? { notation: "compact", maximumFractionDigits: 1 } : {}),
      ...(name ? { currencyDisplay: "name" } : {}),
    });
    formatters.set(key, cached);
  }
  return cached;
}

/** O Intl aceita strings decimais exatas (NumberFormat v3); o tipo do TS ainda não declara. */
function formatDecimal(nf: Intl.NumberFormat, decimal: string): string {
  return nf.format(decimal as unknown as number);
}

function assertCents(cents: number): void {
  if (!Number.isSafeInteger(cents)) {
    throw new TypeError("Valor monetário deve ser inteiro seguro em centavos (Constitution III)");
  }
}

/** Divide centavos em parte inteira e fração sem aritmética de ponto flutuante. */
function splitCents(cents: number): { int: number; frac: number } {
  const abs = Math.abs(cents);
  const frac = abs % 100;
  return { int: (abs - frac) / 100, frac };
}

/** String decimal exata ("1234.56") a partir do inteiro. */
function decimalString(cents: number): string {
  const { int, frac } = splitCents(cents);
  return `${int}.${String(frac).padStart(2, "0")}`;
}

function signFor(cents: number, variant: MoneyVariant): string {
  if (variant === "neutral" || cents === 0) return "";
  if (cents < 0) return MINUS;
  return variant === "movement" ? "+" : "";
}

/**
 * `cents` inteiro (com sinal; negativo = saída) → texto pt-BR. `null` = indisponível ("—").
 * Lança `TypeError` para valor não inteiro ou fora de `Number.isSafeInteger`.
 */
export function formatMoney(cents: number | null, options: MoneyOptions = {}): string {
  const { variant = "movement", currency = "BRL" } = options;
  if (cents === null) return "—";
  assertCents(cents);
  const text = formatDecimal(formatter(currency, variant === "compact"), decimalString(cents));
  return `${signFor(cents, variant)}${text}`;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Leitura por extenso para leitor de tela: "saída de 45 reais e 90 centavos". */
export function moneyToSpeech(cents: number | null, options: MoneyOptions = {}): string {
  const { variant = "movement", currency = "BRL" } = options;
  if (cents === null) return "valor indisponível";
  assertCents(cents);
  if (cents === 0) {
    return currency === "BRL" ? "zero reais" : formatDecimal(formatter(currency, false, true), "0");
  }

  let kind = "";
  if (variant === "movement") kind = cents > 0 ? "entrada de " : "saída de ";
  else if ((variant === "balance" || variant === "compact") && cents < 0) {
    kind = "saldo negativo de ";
  }

  if (currency !== "BRL") {
    return kind + formatDecimal(formatter(currency, false, true), decimalString(cents));
  }

  const { int, frac } = splitCents(cents);
  const words: string[] = [];
  if (int > 0) words.push(plural(int, "real", "reais"));
  if (frac > 0) words.push(plural(frac, "centavo", "centavos"));
  return kind + words.join(" e ");
}

export type MoneyParseResult = { ok: true; cents: number } | { ok: false; error: string };

const THOUSANDS_ONLY = /^\d{1,3}(\.\d{3})+$/;
const INVALID: MoneyParseResult = { ok: false, error: "Informe um valor." };

/**
 * Texto digitado no campo de valor → centavos positivos exatos (plan "parseMoneyInput").
 * O sinal vem do seletor Entrada/Saída, nunca do texto.
 */
export function parseMoneyInput(text: string): MoneyParseResult {
  const t = text.replace(/R\$/g, "").replace(/[\s ]/g, "");
  if (t === "") return INVALID;
  if (t.startsWith("-") || t.startsWith(MINUS)) {
    return { ok: false, error: "Use o seletor Entrada/Saída para o sinal." };
  }
  if (!/^[0-9.,]+$/.test(t)) return INVALID;

  let intPart: string;
  let decPart = "";
  if (t.includes(",")) {
    const at = t.lastIndexOf(",");
    intPart = t.slice(0, at);
    decPart = t.slice(at + 1);
    if (intPart.includes(",")) return INVALID;
    if (intPart.includes(".")) {
      if (!THOUSANDS_ONLY.test(intPart)) return INVALID;
      intPart = intPart.replace(/\./g, "");
    }
  } else if (THOUSANDS_ONLY.test(t)) {
    intPart = t.replace(/\./g, "");
  } else if (!t.includes(".")) {
    intPart = t;
  } else if ((t.match(/\./g) ?? []).length === 1) {
    [intPart, decPart] = t.split(".");
  } else {
    return INVALID;
  }

  if (intPart === "" && decPart === "") return INVALID;
  if (!/^\d*$/.test(intPart) || !/^\d*$/.test(decPart)) return INVALID;
  if (decPart.length > 2) return { ok: false, error: "Use no máximo 2 casas decimais." };
  const digits = intPart.replace(/^0+(?=\d)/, "");
  if (digits.length > 12) return { ok: false, error: "Valor muito alto." };

  // Inteiros < 2^53: soma exata, sem ponto flutuante.
  const cents = Number(digits || "0") * 100 + Number(decPart.padEnd(2, "0"));
  return { ok: true, cents };
}

// ----------------------------------------------------------------- datas (`YYYY-MM-DD`)

const MONTH_SHORT = [
  "jan.",
  "fev.",
  "mar.",
  "abr.",
  "mai.",
  "jun.",
  "jul.",
  "ago.",
  "set.",
  "out.",
  "nov.",
  "dez.",
];
const MONTH_LONG = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

function dateParts(date: string): { y: number; m: number; d: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new TypeError(`Data deve estar no formato YYYY-MM-DD: ${date}`);
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

function toUtc(date: string): number {
  const { y, m, d } = dateParts(date);
  return Date.UTC(y, m - 1, d);
}

const DAY_MS = 86_400_000;

/** Diferença em dias de calendário (b − a), sem depender do fuso do processo. */
function diffDays(a: string, b: string): number {
  return Math.round((toUtc(b) - toUtc(a)) / DAY_MS);
}

/** Soma dias a uma data de calendário. */
export function addDays(date: string, days: number): string {
  return new Date(toUtc(date) + days * DAY_MS).toISOString().slice(0, 10);
}

function shortDate(date: string, withYear: boolean): string {
  const { y, m, d } = dateParts(date);
  return `${d} ${MONTH_SHORT[m - 1]}${withYear ? ` ${y}` : ""}`;
}

/** "Hoje", "Ontem", "Amanhã", "28 set." (mesmo ano) ou "28 set. 2025". */
export function formatRelativeDate(date: string, today: string): string {
  const diff = diffDays(today, date);
  if (diff === 0) return "Hoje";
  if (diff === -1) return "Ontem";
  if (diff === 1) return "Amanhã";
  return shortDate(date, dateParts(date).y !== dateParts(today).y);
}

/** "28/09/2026". */
export function formatAbsoluteDate(date: string): string {
  const { y, m, d } = dateParts(date);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

/** "28 de setembro de 2026" (leitor de tela). */
export function dateToSpeech(date: string): string {
  const { y, m, d } = dateParts(date);
  return `${d} de ${MONTH_LONG[m - 1]} de ${y}`;
}

export type Period = { month: string } | { from: string; to?: string };

/** "Setembro de 2026", "1–15 set.", "28 set. – 3 out.", "28 dez. 2025 – 3 jan. 2026". */
export function formatPeriod(period: Period): string {
  if ("month" in period) {
    const { y, m } = dateParts(`${period.month}-01`);
    const name = MONTH_LONG[m - 1];
    return `${name[0].toUpperCase()}${name.slice(1)} de ${y}`;
  }
  const { from, to } = period;
  if (!to || to === from) return shortDate(from, false);
  const a = dateParts(from);
  const b = dateParts(to);
  if (a.y !== b.y) return `${shortDate(from, true)} – ${shortDate(to, true)}`;
  if (a.m === b.m) return `${a.d}–${b.d} ${MONTH_SHORT[a.m - 1]}`;
  return `${shortDate(from, false)} – ${shortDate(to, false)}`;
}

/** Data de hoje (`YYYY-MM-DD`) no fuso de São Paulo, independente do fuso do aparelho. */
export function todayInSaoPaulo(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(now);
}
