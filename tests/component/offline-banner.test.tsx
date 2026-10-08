import { act, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ComingSoon } from "@/components/shell/coming-soon";
import { OfflineBanner } from "@/components/shell/offline-banner";
import { useOnline } from "@/components/shell/use-online";

/** FR-009 (em breve) e FR-014 (aviso offline que some sozinho). */
function setOnline(value: boolean) {
  Object.defineProperty(navigator, "onLine", { configurable: true, value });
  window.dispatchEvent(new Event(value ? "online" : "offline"));
}

afterEach(() => setOnline(true));

describe("useOnline", () => {
  it("acompanha os eventos online/offline", () => {
    const { result } = renderHook(() => useOnline());
    expect(result.current).toBe(true);
    act(() => setOnline(false));
    expect(result.current).toBe(false);
    act(() => setOnline(true));
    expect(result.current).toBe(true);
  });
});

describe("OfflineBanner", () => {
  const TEXT = "Você está offline. Algumas ações não vão funcionar até a conexão voltar.";

  it("região viva sempre presente, vazia quando online", () => {
    render(<OfflineBanner />);
    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveTextContent("");
  });

  it("aparece ao perder a conexão e some ao reconectar", () => {
    render(<OfflineBanner />);
    act(() => setOnline(false));
    expect(screen.getByRole("status")).toHaveTextContent(TEXT);
    act(() => setOnline(true));
    expect(screen.queryByText(TEXT)).toBeNull();
  });
});

describe("ComingSoon", () => {
  it("texto padrão de 'Em breve'", () => {
    render(<ComingSoon title="Extrato" />);
    expect(screen.getByRole("heading", { name: "Em breve" })).toBeInTheDocument();
    expect(screen.getByText("Esta seção chega numa próxima versão do Prumo.")).toBeInTheDocument();
  });

  it("aceita descrição própria", () => {
    render(<ComingSoon title="Planejamento" description="Cartões, orçamento e metas." />);
    expect(screen.getByText("Cartões, orçamento e metas.")).toBeInTheDocument();
  });
});
