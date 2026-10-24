import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Money } from "@/components/finance/money";

/** contracts/components.md §2 Money — FR-005, FR-019, FR-025..FR-028. */
const NBSP = "\u00a0";
const MINUS = "\u2212";

function visible(container: HTMLElement): string {
  return container.querySelector("[data-money-value] [aria-hidden=true]")?.textContent ?? "";
}

describe("Money", () => {
  it("movimentação de saída: sinal −, cor de saída, algarismos tabulares", () => {
    const { container } = render(<Money cents={-4590} />);
    const root = container.querySelector("[data-money]") as HTMLElement;
    expect(visible(container)).toBe(`${MINUS}R$${NBSP}45,90`);
    expect(root.className).toContain("text-expense");
    expect(root.className).toContain("tabular-nums");
    expect(screen.getByText("saída de 45 reais e 90 centavos")).toHaveClass("sr-only");
  });

  it("movimentação de entrada: sinal + e cor de entrada (não só cor)", () => {
    const { container } = render(<Money cents={123456} />);
    expect(visible(container)).toBe(`+R$${NBSP}1.234,56`);
    expect(container.querySelector("[data-money]")?.className).toContain("text-income");
  });

  it("zero é neutro e sem sinal", () => {
    const { container } = render(<Money cents={0} />);
    expect(visible(container)).toBe(`R$${NBSP}0,00`);
    expect(container.querySelector("[data-money]")?.className).toContain("text-foreground");
  });

  it("saldo: sem +, com − e sempre na cor do texto", () => {
    const { container } = render(<Money cents={-4590} variant="balance" />);
    expect(visible(container)).toBe(`${MINUS}R$${NBSP}45,90`);
    const cls = container.querySelector("[data-money]")?.className ?? "";
    expect(cls).toContain("text-foreground");
    expect(cls).not.toContain("text-expense");
    expect(screen.getByText("saldo negativo de 45 reais e 90 centavos")).toBeInTheDocument();
  });

  it("neutra: sem sinal", () => {
    const { container } = render(<Money cents={-4590} variant="neutral" />);
    expect(visible(container)).toBe(`R$${NBSP}45,90`);
  });

  it("compacta: abreviada, valor completo no popover e para leitor de tela", async () => {
    const { container } = render(<Money cents={123400000} variant="compact" />);
    expect(visible(container)).toBe(`R$${NBSP}1,2${NBSP}mi`);
    expect(screen.getByText("1234000 reais")).toHaveClass("sr-only");
    await userEvent.click(screen.getByRole("button", { name: /1234000 reais/ }));
    expect(await screen.findByRole("dialog")).toHaveTextContent("R$ 1.234.000,00"); // jest-dom normaliza NBSP;
  });

  it("ausente: travessão e 'valor indisponível', nunca R$ 0,00", () => {
    const { container } = render(<Money cents={null} />);
    expect(container.textContent).toContain("—");
    expect(container.textContent).not.toContain("0,00");
    expect(screen.getByText("valor indisponível")).toHaveClass("sr-only");
  });

  it("máscara de privacidade presente, com largura fixa e leitura 'valor oculto'", () => {
    const { container: small } = render(<Money cents={1} />);
    const { container: big } = render(<Money cents={99999999999} />);
    const maskOf = (c: HTMLElement) => c.querySelector("[data-money-mask]");
    expect(maskOf(small)?.textContent).toBe("R$ ••••valor oculto");
    expect(maskOf(big)?.textContent).toBe(maskOf(small)?.textContent);
  });

  it("moeda estrangeira", () => {
    const { container } = render(<Money cents={1000} currency="USD" />);
    expect(visible(container)).toBe(`+US$${NBSP}10,00`);
  });

  it("valor não inteiro é bug: lança TypeError", () => {
    expect(() => render(<Money cents={10.5} />)).toThrow(TypeError);
  });

  it("tamanhos usam a escala de texto", () => {
    const { container } = render(<Money cents={100} size="xl" />);
    expect(container.querySelector("[data-money]")?.className).toContain("text-3xl");
  });
});
