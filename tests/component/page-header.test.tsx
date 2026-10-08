import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Download, Pencil, Plus, Trash2 } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { PageHeader } from "@/components/shell/page-header";

/** contracts/components.md §5 — FR-010, FR-015. */
describe("PageHeader", () => {
  it("título em h1 e área segura superior", () => {
    const { container } = render(<PageHeader title="Extrato" />);
    expect(screen.getByRole("heading", { level: 1, name: "Extrato" })).toBeInTheDocument();
    expect(container.querySelector("header")?.className).toContain("pt-safe");
  });

  it("voltar vira link acessível", () => {
    render(<PageHeader title="Ajustes" back="/mais" />);
    expect(screen.getByRole("link", { name: "Voltar" })).toHaveAttribute("href", "/mais");
  });

  it("sem voltar quando não informado", () => {
    render(<PageHeader title="Início" />);
    expect(screen.queryByRole("link", { name: "Voltar" })).toBeNull();
  });

  it("botão de ocultar valores sempre presente", () => {
    render(<PageHeader title="Início" />);
    expect(screen.getByRole("button", { name: "Ocultar valores" })).toBeInTheDocument();
  });

  it("até 2 ações visíveis", async () => {
    const onAdd = vi.fn();
    render(
      <PageHeader
        title="Extrato"
        actions={[
          { label: "Adicionar", icon: Plus, onClick: onAdd },
          { label: "Exportar", icon: Download, href: "/mais/exportar" },
        ]}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    expect(onAdd).toHaveBeenCalledOnce();
    expect(screen.getByRole("link", { name: "Exportar" })).toHaveAttribute(
      "href",
      "/mais/exportar",
    );
    expect(screen.queryByRole("button", { name: "Mais ações" })).toBeNull();
  });

  it("a partir da 3ª ação, as demais vão para o menu 'Mais ações' (teclado)", async () => {
    const onDelete = vi.fn();
    const user = userEvent.setup();
    render(
      <PageHeader
        title="Extrato"
        actions={[
          { label: "Adicionar", icon: Plus, onClick: vi.fn() },
          { label: "Editar", icon: Pencil, onClick: vi.fn() },
          { label: "Exportar", icon: Download, onClick: vi.fn() },
          { label: "Excluir", icon: Trash2, onClick: onDelete },
        ]}
      />,
    );
    expect(screen.getByRole("button", { name: "Adicionar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Exportar" })).toBeNull();

    const trigger = screen.getByRole("button", { name: "Mais ações" });
    trigger.focus();
    await user.keyboard("{Enter}");
    const items = await screen.findAllByRole("menuitem");
    expect(items.map((item) => item.textContent)).toEqual(["Exportar", "Excluir"]);

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();

    await user.click(trigger);
    await user.click(await screen.findByRole("menuitem", { name: "Excluir" }));
    expect(onDelete).toHaveBeenCalledOnce();
  });
});
