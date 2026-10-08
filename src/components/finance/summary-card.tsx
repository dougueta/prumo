import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { LoadingSkeleton } from "@/components/states/loading-skeleton";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Money } from "./money";

export type SummaryDelta = {
  cents: number;
  label: string;
  trend: "up" | "down" | "flat";
  /** Variação boa para o usuário (ex.: gastou menos) → cor de entrada; senão, de saída. */
  good: boolean;
};

const ARROW = { up: "↑", down: "↓", flat: "→" } as const;

/**
 * Card de resumo (FR-033): título, valor principal e variação opcional com seta + sinal + texto
 * (nunca só cor). Estados próprios de carregando/erro/vazio.
 */
export function SummaryCard({
  title,
  cents,
  variant = "balance",
  compact = false,
  delta,
  state = "ready",
  onRetry,
  href,
}: {
  title: string;
  cents: number | null;
  variant?: "balance" | "movement" | "neutral";
  compact?: boolean;
  delta?: SummaryDelta;
  state?: "ready" | "loading" | "error" | "empty";
  onRetry?: () => void;
  href?: string;
}) {
  let content;
  if (state === "loading") content = <LoadingSkeleton variant="text" rows={2} />;
  else if (state === "error") content = <ErrorState scope="block" onRetry={onRetry} />;
  else if (state === "empty") content = <EmptyState />;
  else
    content = (
      <div className="flex flex-col gap-1">
        <Money cents={cents} variant={compact ? "compact" : variant} size="xl" />
        {delta && (
          <p
            data-slot="summary-delta"
            className={cn("text-sm tabular-nums", delta.good ? "text-income" : "text-expense")}
          >
            <span aria-hidden="true">{ARROW[delta.trend]}</span>{" "}
            {formatMoney(delta.cents, { variant: "movement" })} {delta.label}
          </p>
        )}
      </div>
    );

  return (
    <section
      data-slot="summary-card"
      className="flex min-w-0 flex-col gap-2 overflow-hidden rounded-lg border border-border bg-surface p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-foreground-muted">{title}</h2>
        {href && state === "ready" && (
          <Link
            href={href}
            aria-label={`Ver detalhes: ${title}`}
            className="-m-2 flex min-h-11 min-w-11 items-center justify-center rounded-md text-foreground-muted hover:bg-surface-muted"
          >
            <ChevronRight aria-hidden="true" className="size-4" />
          </Link>
        )}
      </div>
      {content}
    </section>
  );
}
