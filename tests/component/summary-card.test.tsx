import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { GroupedList } from "@/components/finance/grouped-list";
import { SummaryCard } from "@/components/finance/summary-card";
import { TodayProvider } from "@/components/shell/today-provider";
import { DATASET } from "./helpers/synthetic";

/** contracts/components.md §2 SummaryCard/GroupedList — FR-033, FR-034. */
const MINUS = "\u2212";

describe("SummaryCard", () => {
  it("título, valor e variação com seta + sinal + texto (não só cor)", () => {
    const { container } = render(
      <SummaryCard
        title="Saídas do mês"
        cents={-450000}
        variant="movement"
        delta={{ cents: -12000, label: "vs. agosto", trend: "down", good: true }}
      />,
    );
    expect(screen.getByRole("heading", { name: "Saídas do mês" })).toBeInTheDocument();
    const delta = container.querySelector("[data-slot=summary-delta]");
    expect(delta?.textContent?.replace(/\s/g, " ")).toBe(`↓ ${MINUS}R$ 120,00 vs. agosto`);
    expect(delta?.className).toContain("text-income");
  });

  it("variação ruim usa a cor de saída", () => {
    const { container } = render(
      <SummaryCard
        title="Saídas"
        cents={-1}
        delta={{ cents: 5000, label: "vs. agosto", trend: "up", good: false }}
      />,
    );
    expect(container.querySelector("[data-slot=summary-delta]")?.className).toContain(
      "text-expense",
    );
  });

  it("estado carregando: esqueleto ocupado", () => {
    const { container } = render(<SummaryCard title="Saldo" cents={null} state="loading" />);
    expect(container.querySelector("[aria-busy=true]")).not.toBeNull();
  });

  it("estado de erro com 'Tentar novamente'", async () => {
    const onRetry = vi.fn();
    render(<SummaryCard title="Saldo" cents={null} state="error" onRetry={onRetry} />);
    await userEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("estado vazio", () => {
    render(<SummaryCard title="Saldo" cents={null} state="empty" />);
    expect(screen.getByText("Nada por aqui ainda.")).toBeInTheDocument();
  });

  it("valor ≥ R$ 1 bi não quebra: valor sem quebra, cartão com min-w-0", () => {
    const { container } = render(<SummaryCard title="Patrimônio" cents={100000000000} />);
    expect(container.querySelector("[data-money]")?.className).toContain("whitespace-nowrap");
    expect(container.querySelector("[data-slot=summary-card]")?.className).toContain("min-w-0");
  });

  it("compacto usa a variante compacta", () => {
    render(<SummaryCard title="Patrimônio" cents={123400000} compact />);
    expect(screen.getByRole("button", { name: /1234000 reais/ })).toBeInTheDocument();
  });
});

describe("GroupedList", () => {
  const items = DATASET.transactions.slice(0, 3);

  it("agrupa por data com cabeçalho relativo, total do dia e lista semântica", () => {
    const { container } = render(
      <TodayProvider today="2026-09-30" fixed>
        <GroupedList
          groups={[
            {
              date: "2026-09-30",
              totalCents: -4590,
              items: items.map((t) => <span key={t.id}>{t.description}</span>),
            },
            { date: "2026-09-29", items: [<span key="x">{items[0].description}</span>] },
          ]}
        />
      </TodayProvider>,
    );
    const lists = container.querySelectorAll("ul");
    expect(lists.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole("heading", { name: /Hoje/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Ontem/ })).toBeInTheDocument();
    const firstList = lists[1] ?? lists[0];
    expect(within(firstList as HTMLElement).getAllByRole("listitem").length).toBeGreaterThan(0);
    expect(container.textContent).toContain("saída de 45 reais e 90 centavos");
  });

  it("vazio mostra o estado vazio informado", () => {
    render(<GroupedList groups={[]} emptyState={<p>Nada por aqui ainda.</p>} />);
    expect(screen.getByText("Nada por aqui ainda.")).toBeInTheDocument();
  });
});
