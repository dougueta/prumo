import type { ReactNode } from "react";
import { Money } from "./money";
import { RelativeDate } from "./relative-date";

export type GroupedListGroup = { date: string; totalCents?: number; items: ReactNode[] };

/**
 * Lista agrupada por data (FR-034): cabeçalho com data relativa e total opcional do dia,
 * lista semântica. Itens normalmente são `<TransactionItem showDate={false} />`; cada um vira um `<li>`.
 */
export function GroupedList({
  groups,
  emptyState,
}: {
  groups: GroupedListGroup[];
  emptyState?: ReactNode;
}) {
  if (groups.length === 0) return <>{emptyState}</>;
  return (
    <ul className="flex flex-col gap-4">
      {groups.map((group) => (
        <li key={group.date}>
          <section aria-labelledby={`grupo-${group.date}`}>
            <div className="flex items-center justify-between gap-3 border-b border-border pb-1 text-sm">
              <h2 id={`grupo-${group.date}`} className="font-semibold text-foreground-muted">
                <RelativeDate date={group.date} />
              </h2>
              {group.totalCents !== undefined && (
                <Money cents={group.totalCents} variant="movement" size="sm" />
              )}
            </div>
            <ul className="divide-y divide-border">
              {group.items.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </section>
        </li>
      ))}
    </ul>
  );
}
