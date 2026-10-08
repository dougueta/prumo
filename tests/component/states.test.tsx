import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { LoadingSkeleton } from "@/components/states/loading-skeleton";
import { SlowLoading } from "@/components/states/slow-loading";

/** contracts/components.md §3 — FR-037, FR-038; máquina de estados do data-model §6. */
afterEach(() => vi.useRealTimers());

describe("EmptyState", () => {
  it("vazio com texto e ação principal", () => {
    render(
      <EmptyState
        title="Nenhuma transação ainda"
        description="Conecte uma conta para começar."
        action={{ label: "Conectar conta", href: "/mais/contas" }}
      />,
    );
    expect(screen.getByRole("heading", { name: "Nenhuma transação ainda" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Conectar conta" })).toHaveAttribute(
      "href",
      "/mais/contas",
    );
  });

  it("título padrão quando não informado", () => {
    render(<EmptyState />);
    expect(screen.getByRole("heading", { name: "Nada por aqui ainda." })).toBeInTheDocument();
  });

  it("sem resultados de filtro: texto distinto e 'Limpar filtros'", async () => {
    const onClear = vi.fn();
    render(<EmptyState variant="no-results" onClearFilters={onClear} />);
    expect(
      screen.getByRole("heading", { name: "Nenhum resultado para este filtro." }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(onClear).toHaveBeenCalledOnce();
  });
});

describe("LoadingSkeleton", () => {
  it.each(["list", "card", "page", "text"] as const)("%s ocupado e anunciado", (variant) => {
    const { container } = render(<LoadingSkeleton variant={variant} />);
    expect(container.firstElementChild).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Carregando…")).toHaveClass("sr-only");
  });

  it("lista com o número de linhas pedido", () => {
    const { container } = render(<LoadingSkeleton variant="list" rows={5} />);
    expect(container.querySelectorAll("[data-slot=skeleton-row]")).toHaveLength(5);
  });
});

describe("SlowLoading", () => {
  it("troca o esqueleto pela mensagem de demora após 10 s, com nova tentativa", async () => {
    vi.useFakeTimers();
    const onRetry = vi.fn();
    render(
      <SlowLoading onRetry={onRetry}>
        <LoadingSkeleton variant="list" />
      </SlowLoading>,
    );
    act(() => vi.advanceTimersByTime(9_999));
    expect(screen.queryByText("Está demorando mais que o normal.")).toBeNull();
    expect(screen.getByText("Carregando…")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByText("Está demorando mais que o normal.")).toBeInTheDocument();
    vi.useRealTimers();
    await userEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});

describe("ErrorState", () => {
  it("textos padrão, sem detalhe técnico, com 'Tentar novamente'", async () => {
    const onRetry = vi.fn();
    const { container } = render(<ErrorState onRetry={onRetry} />);
    expect(screen.getByText("Não foi possível carregar.")).toBeInTheDocument();
    expect(screen.getByText("Verifique sua conexão e tente de novo.")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/error|stack|digest|undefined/i);
    await userEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("sem onRetry não oferece botão", () => {
    render(<ErrorState />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("erro parcial: só o bloco que falhou mostra erro; o irmão continua utilizável", async () => {
    const onUse = vi.fn();
    render(
      <div>
        <section aria-label="Saldo">
          <ErrorState scope="block" onRetry={vi.fn()} />
        </section>
        <section aria-label="Gastos">
          <button type="button" onClick={onUse}>
            Ver gastos
          </button>
        </section>
      </div>,
    );
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getByRole("region", { name: "Saldo" })).toContainElement(
      screen.getByRole("alert"),
    );
    await userEvent.click(screen.getByRole("button", { name: "Ver gastos" }));
    expect(onUse).toHaveBeenCalledOnce();
  });

  it("escopo de página não usa role=alert", () => {
    render(<ErrorState scope="page" />);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
