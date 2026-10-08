import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "./category-icon";
import type { CategoryVisualKey } from "./category-visuals";
import { Money } from "./money";
import { RelativeDate } from "./relative-date";
import { SourceBadge, type SourceBadgeData } from "./source-badge";

/** View model do item (contracts/components.md §2); o mapeamento a partir da 004 é das features. */
export type TransactionItemData = {
  id: string;
  description: string;
  amountCents: number;
  currency?: string;
  date: string;
  category?: { name: string; visual: CategoryVisualKey } | null;
  account: { name: string; institutionName: string; institutionIcon?: string };
  status?: "posted" | "pending";
  installment?: { number: number; total: number };
  nature?: "regular" | "internal_transfer" | "card_payment" | "refund";
  original?: { amountMinor: number; currency: string };
  categorization?: SourceBadgeData;
};

const NATURE_LABEL = {
  internal_transfer: "Entre contas",
  card_payment: "Pagamento de fatura",
  refund: "Estorno",
} as const;

/**
 * Item de transação (FR-032): ícone/cor da categoria, descrição (até 2 linhas), categoria ·
 * conta · data, valor à direita (nunca empurrado para fora) e indicadores em texto.
 * Acionável por link (`href`) ou ação (`onSelect`).
 */
export function TransactionItem({
  data,
  href,
  onSelect,
  density = "normal",
  showDate = true,
}: {
  data: TransactionItemData;
  href?: string;
  onSelect?: () => void;
  density?: "normal" | "compact";
  showDate?: boolean;
}) {
  const compact = density === "compact";
  const nature = data.nature && data.nature !== "regular" ? NATURE_LABEL[data.nature] : null;
  const visual = data.category?.visual ?? "sem-categoria";

  const body = (
    <>
      <CategoryIcon visual={visual} size={compact ? "sm" : "md"} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          data-slot="transaction-description"
          title={data.description}
          className="line-clamp-2 font-medium break-words"
        >
          {data.description}
        </span>
        <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-foreground-muted">
          <span>{data.category?.name ?? "Sem categoria"}</span>
          <span aria-hidden="true">·</span>
          <span>{data.account.name}</span>
          {showDate && (
            <>
              <span aria-hidden="true">·</span>
              <RelativeDate date={data.date} />
            </>
          )}
          {data.original && (
            <>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">
                {formatMoney(data.original.amountMinor, {
                  variant: "neutral",
                  currency: data.original.currency,
                })}
              </span>
            </>
          )}
        </span>
        {(data.status === "pending" || data.installment || nature) && (
          <span className="flex flex-wrap gap-1.5">
            {data.status === "pending" && <Badge variant="outline">Pendente</Badge>}
            {data.installment && (
              <Badge variant="outline">
                {data.installment.number}/{data.installment.total}
              </Badge>
            )}
            {nature && <Badge variant="secondary">{nature}</Badge>}
          </span>
        )}
      </div>
      <span
        data-slot="transaction-amount"
        className={cn("shrink-0 text-right", data.status === "pending" && "opacity-70")}
      >
        <Money cents={data.amountCents} currency={data.currency} size={compact ? "sm" : "md"} />
      </span>
    </>
  );

  const rowClass = cn(
    "flex w-full items-start gap-3 text-left",
    compact ? "py-2" : "py-3",
    (href || onSelect) && "rounded-md px-2 transition-colors duration-fast hover:bg-surface-muted",
  );

  return (
    <div data-density={density} className="flex flex-col">
      {href ? (
        <Link href={href} className={rowClass}>
          {body}
        </Link>
      ) : onSelect ? (
        <button type="button" onClick={onSelect} className={rowClass}>
          {body}
        </button>
      ) : (
        <div className={rowClass}>{body}</div>
      )}
      {data.categorization && (
        <div className={cn("pb-2", compact ? "pl-11" : "pl-13")}>
          <SourceBadge {...data.categorization} />
        </div>
      )}
    </div>
  );
}
