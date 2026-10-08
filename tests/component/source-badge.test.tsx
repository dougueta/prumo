import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SourceBadge } from "@/components/finance/source-badge";

/** contracts/components.md §2 SourceBadge — FR-035, Constitution VI. */
describe("SourceBadge", () => {
  it.each([
    [{ origin: "manual" } as const, "Manual"],
    [{ origin: "rule", ruleName: "Mercado" } as const, "Regra"],
    [{ origin: "source" } as const, "Fonte"],
    [{ origin: "ai", confidence: "high" } as const, "IA · confiança alta"],
    [{ origin: "ai", confidence: "medium" } as const, "IA · confiança média"],
    [{ origin: "ai", confidence: "low" } as const, "IA · revisar"],
  ])("%j → %s", (props, label) => {
    render(<SourceBadge {...props} />);
    expect(screen.getByRole("button", { name: new RegExp(label) })).toBeInTheDocument();
  });

  it("confiança baixa destacada em warning", () => {
    render(<SourceBadge origin="ai" confidence="low" />);
    expect(screen.getByRole("button", { name: /revisar/ }).className).toContain("text-warning");
  });

  it("IA usa o token de IA", () => {
    render(<SourceBadge origin="ai" confidence="high" />);
    expect(screen.getByRole("button", { name: /IA/ }).className).toContain("text-ai");
  });

  it("toque explica a origem e oferece 'Corrigir'", async () => {
    const onCorrect = vi.fn();
    render(<SourceBadge origin="ai" confidence="medium" onCorrect={onCorrect} />);
    await userEvent.click(screen.getByRole("button", { name: /IA/ }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent(
      "Categoria sugerida pela IA com confiança média. Você pode corrigir — sua correção vira regra.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Corrigir" }));
    expect(onCorrect).toHaveBeenCalledOnce();
  });

  it("fonte nomeia quem informou a categoria", async () => {
    render(<SourceBadge origin="source" sourceName="o arquivo importado" />);
    await userEvent.click(screen.getByRole("button", { name: /Fonte/ }));
    expect(await screen.findByRole("dialog")).toHaveTextContent(
      "Categoria informada por o arquivo importado.",
    );
  });

  it("fonte sem nome usa 'a instituição' e sem onCorrect não há botão Corrigir", async () => {
    render(<SourceBadge origin="source" />);
    await userEvent.click(screen.getByRole("button", { name: /Fonte/ }));
    expect(await screen.findByRole("dialog")).toHaveTextContent(
      "Categoria informada por a instituição.",
    );
    expect(screen.queryByRole("button", { name: "Corrigir" })).toBeNull();
  });
});
