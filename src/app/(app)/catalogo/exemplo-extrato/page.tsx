import { CATALOG_TODAY, catalogExamples, recentDates, transactionsOn } from "@/catalog/examples";
import { GroupedList } from "@/components/finance/grouped-list";
import { SummaryCard } from "@/components/finance/summary-card";
import { TransactionItem } from "@/components/finance/transaction-item";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";

export const metadata = { title: "Exemplo de extrato · Catálogo · Prumo" };

/**
 * Tela de exemplo (contracts/catalog.md §5, SC-006): um extrato fictício montado só com
 * componentes públicos do design system — prova de que uma tela de feature cabe nos fundamentos.
 */
export default function ExampleStatementPage() {
  const month = CATALOG_TODAY.slice(0, 7);
  const ofMonth = catalogExamples().transactions.filter((t) => t.date.startsWith(month));
  const income = ofMonth.filter((t) => t.amountCents > 0).reduce((s, t) => s + t.amountCents, 0);
  const expense = ofMonth.filter((t) => t.amountCents < 0).reduce((s, t) => s + t.amountCents, 0);
  const dates = recentDates(3);

  return (
    <>
      <PageHeader title="Extrato (exemplo)" back="/catalogo" />
      <div className="flex flex-col gap-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryCard title="Entradas do mês" cents={income} variant="movement" />
          <SummaryCard title="Saídas do mês" cents={expense} variant="movement" />
          <section aria-label="Saldo">
            <ErrorState scope="block" />
          </section>
        </div>
        <GroupedList
          groups={dates.map((date) => {
            const items = transactionsOn(date);
            return {
              date,
              totalCents: items.reduce((s, t) => s + t.amountCents, 0),
              items: items.map((item) => (
                <TransactionItem
                  key={item.id}
                  data={item}
                  showDate={false}
                  href="/catalogo/exemplo-extrato"
                />
              )),
            };
          })}
          emptyState={<EmptyState title="Nenhuma transação ainda" />}
        />
      </div>
    </>
  );
}
