import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Logo } from "@/components/brand/logo";
import { LOGO_VIEWBOX, plumbGeometry } from "@/components/brand/logo-geometry";

/** FR-006 — logotipo "Prumo" (fio de prumo) único, compartilhado com os ícones da PWA. */
describe("Logo", () => {
  it("é uma imagem acessível chamada Prumo", () => {
    render(<Logo />);
    expect(screen.getByRole("img", { name: "Prumo" })).toBeInTheDocument();
  });

  it("mostra o nome Prumo sem duplicar a leitura", () => {
    const { container } = render(<Logo />);
    const word = [...container.querySelectorAll("span")].find((s) => s.textContent === "Prumo");
    expect(word).toBeDefined();
    expect(word).toHaveAttribute("aria-hidden", "true");
  });

  it("variante símbolo não mostra o nome visível", () => {
    const { container } = render(<Logo variant="symbol" />);
    expect(screen.getByRole("img", { name: "Prumo" })).toBeInTheDocument();
    expect(container.textContent).toBe("");
  });

  it("usa currentColor (cor vem do token do contexto) e a geometria compartilhada", () => {
    const { container } = render(<Logo />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("viewBox", `0 0 ${LOGO_VIEWBOX} ${LOGO_VIEWBOX}`);
    const geometry = plumbGeometry(LOGO_VIEWBOX, 0);
    const path = svg?.querySelector("path");
    expect(path).toHaveAttribute("d", geometry.bob);
    expect(path).toHaveAttribute("fill", "currentColor");
    const line = svg?.querySelector("line");
    expect(line).toHaveAttribute("stroke", "currentColor");
    expect(Number(line?.getAttribute("y1"))).toBeCloseTo(geometry.line.y1);
  });
});
