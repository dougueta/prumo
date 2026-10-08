import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Plus } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "@/components/ui/button";

/** contracts/components.md §1 — FR-020, FR-021, FR-041. */
describe("Button", () => {
  it.each(["primary", "secondary", "ghost", "destructive"] as const)(
    "variante %s usa tokens e expõe data-variant",
    (variant) => {
      render(<Button variant={variant}>Salvar</Button>);
      const button = screen.getByRole("button", { name: "Salvar" });
      expect(button).toHaveAttribute("data-variant", variant);
    },
  );

  it("principal é o padrão e usa a cor da marca", () => {
    render(<Button>Salvar</Button>);
    const button = screen.getByRole("button", { name: "Salvar" });
    expect(button).toHaveAttribute("data-variant", "primary");
    expect(button.className).toContain("bg-primary");
  });

  it("destrutivo usa danger (nunca a cor de saída)", () => {
    render(<Button variant="destructive">Excluir</Button>);
    const button = screen.getByRole("button", { name: "Excluir" });
    expect(button.className).toContain("bg-danger");
    expect(button.className).not.toContain("expense");
  });

  it("pending desabilita, anuncia ocupado, mostra spinner e ignora cliques", async () => {
    const onClick = vi.fn();
    render(
      <Button pending onClick={onClick}>
        Salvar
      </Button>,
    );
    const button = screen.getByRole("button", { name: /Salvar/ });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button.querySelector("[data-slot=spinner]")).not.toBeNull();
    await userEvent.click(button);
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it.each(["sm", "md"] as const)("tamanho %s tem alvo de toque ≥ 44px", (size) => {
    render(<Button size={size}>Ok</Button>);
    expect(screen.getByRole("button", { name: "Ok" }).className).toContain("min-h-11");
  });

  it("botão de ícone tem 44×44 e nome acessível", () => {
    render(
      <Button size="icon" aria-label="Adicionar">
        <Plus />
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Adicionar" });
    expect(button.className).toContain("min-h-11");
    expect(button.className).toContain("min-w-11");
  });

  it("botão de ícone sem aria-label acusa erro", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      // @ts-expect-error — o tipo exige aria-label em size="icon"
      <Button size="icon">
        <Plus />
      </Button>,
    );
    expect(error).toHaveBeenCalledWith(expect.stringContaining("aria-label"));
    error.mockRestore();
  });

  it("primitivos não usam a paleta padrão removida (bg-black/text-white)", () => {
    const dir = path.resolve(__dirname, "../../src/components/ui");
    const offenders = readdirSync(dir).filter((file) =>
      /\b(bg-black|text-white|bg-white|text-black)\b/.test(
        readFileSync(path.join(dir, file), "utf8"),
      ),
    );
    expect(offenders).toEqual([]);
  });
});
