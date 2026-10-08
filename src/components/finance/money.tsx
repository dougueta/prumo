import { formatMoney, moneyToSpeech, type MoneyVariant } from "@/lib/format";
import { cn } from "@/lib/utils";
import { MoneyCompact } from "./money-compact";

export type MoneyProps = {
  /** Inteiro seguro em centavos, com sinal (negativo = saída). `null` = indisponível. */
  cents: number | null;
  /** ISO 4217; padrão BRL. */
  currency?: string;
  variant?: MoneyVariant;
  size?: "sm" | "md" | "lg" | "xl";
  /** Só layout (margens/alinhamento), nunca cor. */
  className?: string;
};

const SIZES = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-xl font-semibold",
  xl: "text-3xl font-semibold",
} as const;

/** Máscara de largura fixa: não revela a ordem de grandeza (FR-027). */
const MASK = "R$ ••••";

function colorFor(cents: number, variant: MoneyVariant): string {
  if (variant !== "movement" || cents === 0) return "text-foreground";
  return cents > 0 ? "text-income" : "text-expense";
}

/**
 * Valor monetário do Prumo (FR-025..FR-028): centavos inteiros → pt-BR, sinal sempre visível
 * em movimentação (nunca só cor), algarismos tabulares, leitura por extenso e máscara do modo
 * privacidade (alternada por CSS via html[data-privacy]).
 */
export function Money({
  cents,
  currency = "BRL",
  variant = "movement",
  size = "md",
  className,
}: MoneyProps) {
  if (cents === null) {
    return (
      <span
        data-money
        className={cn(
          "whitespace-nowrap text-foreground-muted tabular-nums",
          SIZES[size],
          className,
        )}
      >
        <span aria-hidden="true">—</span>
        <span className="sr-only">valor indisponível</span>
      </span>
    );
  }

  const text = formatMoney(cents, { variant, currency });
  const speech = moneyToSpeech(cents, { variant, currency });
  const shown = <span aria-hidden="true">{text}</span>;

  return (
    <span
      data-money
      className={cn(
        "whitespace-nowrap tabular-nums",
        SIZES[size],
        colorFor(cents, variant),
        className,
      )}
    >
      <span data-money-value>
        {variant === "compact" ? (
          <MoneyCompact full={formatMoney(cents, { variant: "balance", currency })} speech={speech}>
            {shown}
          </MoneyCompact>
        ) : (
          shown
        )}
        <span className="sr-only">{speech}</span>
      </span>
      <span data-money-mask>
        <span aria-hidden="true">{MASK}</span>
        <span className="sr-only">valor oculto</span>
      </span>
    </span>
  );
}
