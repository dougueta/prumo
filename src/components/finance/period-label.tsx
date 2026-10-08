import { formatPeriod, type Period } from "@/lib/format";

/** Mês/ano ou intervalo em pt-BR: "Setembro de 2026", "1–15 set." (FR-030). */
export function PeriodLabel(props: Period) {
  return <span>{formatPeriod(props)}</span>;
}
