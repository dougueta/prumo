"use client";

import { useToday } from "@/components/shell/today-provider";
import { dateToSpeech, formatAbsoluteDate, formatRelativeDate } from "@/lib/format";

/**
 * Data de negócio (`YYYY-MM-DD`): relativa ("Hoje", "Ontem", "28 set.") ou absoluta
 * ("28/09/2026"), no fuso de São Paulo (FR-029). A data completa vai ao leitor de tela por
 * texto oculto (aria-label não é permitido em <time> sem papel interativo).
 */
export function RelativeDate({
  date,
  variant = "relative",
}: {
  date: string;
  variant?: "relative" | "absolute";
}) {
  const today = useToday();
  const text = variant === "absolute" ? formatAbsoluteDate(date) : formatRelativeDate(date, today);
  // "Hoje"/"Ontem"/"Amanhã" também vão ao leitor de tela, junto da data completa.
  const speech = /^(Hoje|Ontem|Amanhã)$/.test(text)
    ? `${text}, ${dateToSpeech(date)}`
    : dateToSpeech(date);
  return (
    <time dateTime={date} title={formatAbsoluteDate(date)}>
      <span aria-hidden="true">{text}</span>
      <span className="sr-only">{speech}</span>
    </time>
  );
}
