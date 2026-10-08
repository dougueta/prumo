import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { InstitutionAvatar } from "@/components/finance/institution-avatar";
import { TransactionItem, type TransactionItemData } from "@/components/finance/transaction-item";
import { TodayProvider } from "@/components/shell/today-provider";
import { firstOfKind } from "./helpers/synthetic";

/** contracts/components.md §2 TransactionItem — FR-032, FR-036. Dados: gerador seed 42. */
function data(kind: Parameters<typeof firstOfKind>[0], extra: Partial<TransactionItemData> = {}) {
  const { tx, account, institution } = firstOfKind(kind);
  const base: TransactionItemData = {
    id: tx.id,
    description: tx.description,
    amountCents: tx.amountCents,
    date: tx.date,
    category: { name: "Alimentação", visual: "alimentacao" },
    account: { name: account.name, institutionName: institution.name },
  };
  return { ...base, ...extra };
}

function renderItem(node: React.ReactNode) {
  return render(
    <TodayProvider today="2026-09-30" fixed>
      <ul>
        <li>{node}</li>
      </ul>
    </TodayProvider>,
  );
}

describe("TransactionItem", () => {
  it("mostra ícone da categoria, descrição, categoria, conta, data e valor", () => {
    const item = data("purchase");
    const { container } = renderItem(<TransactionItem data={item} />);
    expect(screen.getByText(item.description)).toBeInTheDocument();
    expect(screen.getByText("Alimentação")).toBeInTheDocument();
    expect(screen.getByText(item.account.name)).toBeInTheDocument();
    expect(container.querySelector("time")).toHaveAttribute("datetime", item.date);
    expect(container.querySelector("[data-money]")).not.toBeNull();
    expect(container.querySelector("[data-slot=category-icon] svg")).not.toBeNull();
  });

  it("sem categoria", () => {
    renderItem(<TransactionItem data={data("purchase", { category: null })} />);
    expect(screen.getByText("Sem categoria")).toBeInTheDocument();
  });

  it("pendente: selo de texto e valor esmaecido", () => {
    const { container } = renderItem(
      <TransactionItem data={data("purchase", { status: "pending" })} />,
    );
    expect(screen.getByText("Pendente")).toBeInTheDocument();
    expect(container.querySelector("[data-slot=transaction-amount]")?.className).toContain(
      "opacity-70",
    );
  });

  it("parcela 3/10", () => {
    const { tx } = firstOfKind("installment");
    renderItem(
      <TransactionItem data={data("installment", { installment: tx.installment ?? undefined })} />,
    );
    const { number, total } = tx.installment ?? { number: 0, total: 0 };
    expect(screen.getByText(`${number}/${total}`)).toBeInTheDocument();
  });

  it.each([
    ["internal_transfer", "Entre contas"],
    ["card_payment", "Pagamento de fatura"],
    ["refund", "Estorno"],
  ] as const)("natureza %s vira selo de texto %s", (nature, label) => {
    renderItem(<TransactionItem data={data("purchase", { nature })} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("compra internacional mostra o valor na moeda original", () => {
    const { tx } = firstOfKind("international");
    const original = tx.originalCurrency;
    if (!original) throw new Error("sem moeda original");
    renderItem(
      <TransactionItem
        data={data("international", {
          original: { amountMinor: original.amountMinor, currency: original.code },
        })}
      />,
    );
    expect(screen.getByText(/US\$/)).toBeInTheDocument();
  });

  it("descrição longa: até 2 linhas, texto completo no título; valor nunca encolhe", () => {
    const item = data("purchase", { description: `${data("purchase").description} `.repeat(12) });
    const { container } = renderItem(
      <TransactionItem data={{ ...item, amountCents: -100000000000 }} />,
    );
    const description = container.querySelector("[data-slot=transaction-description]");
    expect(description?.className).toContain("line-clamp-2");
    expect(description).toHaveAttribute("title", item.description);
    expect(description?.parentElement?.className).toContain("min-w-0");
    const amount = container.querySelector("[data-slot=transaction-amount]");
    expect(amount?.className).toContain("shrink-0");
    expect(amount?.querySelector("[data-money]")?.className).toContain("whitespace-nowrap");
  });

  it("com href vira link; com onSelect vira botão", async () => {
    const onSelect = vi.fn();
    const item = data("purchase");
    const { unmount } = renderItem(<TransactionItem data={item} href={`/extrato/${item.id}`} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", `/extrato/${item.id}`);
    unmount();
    renderItem(<TransactionItem data={item} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole("button"));
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it("densidade compacta e sem data dentro de lista agrupada", () => {
    const { container } = renderItem(
      <TransactionItem data={data("purchase")} density="compact" showDate={false} />,
    );
    expect(container.querySelector("[data-density=compact]")).not.toBeNull();
    expect(container.querySelector("time")).toBeNull();
  });
});

describe("InstitutionAvatar", () => {
  it("mostra as iniciais quando não há ícone", () => {
    const { institution } = firstOfKind("purchase");
    const { container } = render(<InstitutionAvatar name={institution.name} />);
    expect(container.textContent).toMatch(/^[A-ZÀ-Ý?]{1,2}$/);
    expect(container.querySelector("svg")).toBeNull();
  });
});
