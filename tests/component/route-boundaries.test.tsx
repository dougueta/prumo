import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import RouteError from "@/app/(app)/error";
import AppLoading from "@/app/(app)/loading";
import AppNotFound from "@/app/(app)/not-found";
import GlobalError from "@/app/global-error";
import RootNotFound from "@/app/not-found";

/** contracts/navigation.md §5 — FR-037, FR-038: fronteiras de rota em pt-BR, sem detalhe técnico. */
const secret = Object.assign(new Error("SELECT * FROM transactions — senha=xyz"), {
  digest: "123456789",
});

describe("fronteiras de rota", () => {
  it("(app)/loading: esqueleto ocupado", () => {
    const { container } = render(<AppLoading />);
    expect(container.querySelector("[aria-busy=true]")).not.toBeNull();
    expect(screen.getByText("Carregando…")).toBeInTheDocument();
  });

  it("(app)/error: texto padrão, 'Tentar novamente' chama retry, nunca mostra o erro", async () => {
    const retry = vi.fn();
    const { container } = render(<RouteError error={secret} retry={retry} reset={vi.fn()} />);
    expect(screen.getByText("Não foi possível carregar.")).toBeInTheDocument();
    expect(container.textContent).not.toContain("SELECT");
    expect(container.textContent).not.toContain("123456789");
    await userEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it("(app)/error: sem retry (Next antigo), usa reset", async () => {
    const reset = vi.fn();
    render(<RouteError error={secret} reset={reset} />);
    await userEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(reset).toHaveBeenCalledOnce();
  });

  it("global-error: documento próprio em pt-BR com os textos padrão", () => {
    const html = renderToStaticMarkup(<GlobalError error={secret} retry={vi.fn()} />);
    expect(html).toContain('<html lang="pt-BR"');
    expect(html).toContain("Algo deu errado.");
    expect(html).toContain("Tente de novo em instantes.");
    expect(html).toContain("Tentar novamente");
    expect(html).not.toContain("SELECT");
    expect(html).not.toContain("123456789");
  });

  it.each([
    ["(app)/not-found", AppNotFound],
    ["not-found raiz", RootNotFound],
  ])("%s: 'Página não encontrada' + 'Voltar ao início'", (_, Component) => {
    render(<Component />);
    expect(screen.getByRole("heading", { name: "Página não encontrada" })).toBeInTheDocument();
    expect(screen.getByText("O endereço pode ter mudado.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voltar ao início" })).toHaveAttribute("href", "/");
  });
});
