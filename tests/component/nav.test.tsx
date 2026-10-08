import { render, screen, within } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { describe, expect, it, vi } from "vitest";
import { BottomNav } from "@/components/shell/bottom-nav";
import { SideNav } from "@/components/shell/side-nav";

/** contracts/navigation.md §1 — FR-007, FR-011, FR-015, FR-021. */
const LABELS = ["Início", "Extrato", "Planejamento", "Investimentos", "Mais"];

describe.each([
  ["BottomNav", BottomNav],
  ["SideNav", SideNav],
] as const)("%s", (name, Nav) => {
  it("landmark 'Principal' com os 5 destinos na ordem, ícone + rótulo", () => {
    render(<Nav />);
    const nav = screen.getByRole("navigation", { name: "Principal" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(LABELS);
    for (const link of links) {
      expect(link.querySelector("svg")).not.toBeNull();
      expect(link.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
      expect(link.className).toContain("min-h-11");
    }
  });

  it("marca o destino ativo com aria-current pela regra de prefixo", () => {
    vi.mocked(usePathname).mockReturnValue("/extrato/abc");
    render(<Nav />);
    const nav = screen.getByRole("navigation", { name: "Principal" });
    expect(within(nav).getByRole("link", { name: "Extrato" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(nav).getByRole("link", { name: "Início" })).not.toHaveAttribute("aria-current");
    expect(name).toBeTruthy();
  });

  it("Início só fica ativo na raiz exata", () => {
    vi.mocked(usePathname).mockReturnValue("/");
    render(<Nav />);
    expect(screen.getByRole("link", { name: "Início" })).toHaveAttribute("aria-current", "page");
  });
});

describe("BottomNav", () => {
  it("respeita a área segura inferior e some no desktop", () => {
    render(<BottomNav />);
    const nav = screen.getByRole("navigation", { name: "Principal" });
    expect(nav.className).toContain("pb-safe");
    expect(nav.className).toContain("md:hidden");
  });
});

describe("SideNav", () => {
  it("mostra o logotipo e só aparece a partir de md", () => {
    render(<SideNav />);
    const nav = screen.getByRole("navigation", { name: "Principal" });
    expect(nav.closest("[data-slot=side-nav]")?.className).toMatch(
      /hidden.*md:flex|md:flex.*hidden/,
    );
    expect(screen.getByRole("img", { name: "Prumo" })).toBeInTheDocument();
  });
});
