import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "@/components/forms/confirm-dialog";
import { notify } from "@/components/forms/notify";
import { ResponsiveDialog } from "@/components/forms/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";

/** contracts/components.md §4 — FR-024, FR-042, FR-043, FR-044. */
const realMatchMedia = window.matchMedia;
afterEach(() => {
  window.matchMedia = realMatchMedia;
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  vi.restoreAllMocks();
});

function desktop() {
  window.matchMedia = (query: string) =>
    ({ ...realMatchMedia(query), matches: query.includes("min-width") }) as MediaQueryList;
}

describe("ConfirmDialog", () => {
  function renderConfirm(onConfirm = vi.fn()) {
    render(
      <ConfirmDialog
        trigger={<Button variant="destructive">Excluir</Button>}
        title="Excluir transação 'Mercado'?"
        description="Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        destructive
        onConfirm={onConfirm}
      />,
    );
    return onConfirm;
  }

  it("nomeia ação e objeto e foca 'Cancelar' primeiro", async () => {
    renderConfirm();
    await userEvent.click(screen.getByRole("button", { name: "Excluir" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Excluir transação 'Mercado'?" });
    expect(dialog).toHaveTextContent("Esta ação não pode ser desfeita.");
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancelar" })).toHaveFocus());
  });

  it("botão destrutivo diferenciado e confirmação chama a ação", async () => {
    const onConfirm = renderConfirm();
    await userEvent.click(screen.getByRole("button", { name: "Excluir" }));
    const dialog = await screen.findByRole("alertdialog");
    const confirm = Array.from(dialog.querySelectorAll("button")).find(
      (b) => b.textContent === "Excluir",
    );
    expect(confirm).toHaveAttribute("data-variant", "destructive");
    await userEvent.click(confirm as HTMLButtonElement);
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("não fecha por toque fora; Esc fecha e devolve o foco ao gatilho", async () => {
    renderConfirm();
    const trigger = screen.getByRole("button", { name: "Excluir" });
    await userEvent.click(trigger);
    await screen.findByRole("alertdialog");
    const overlay = document.querySelector("[data-slot=alert-dialog-overlay]");
    expect(overlay?.className).toContain("bg-overlay");
    await userEvent.click(overlay as Element);
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});

function DialogHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Abrir</Button>
      <ResponsiveDialog open={open} onOpenChange={setOpen} title="Filtros">
        <input aria-label="Busca" />
      </ResponsiveDialog>
    </>
  );
}

describe("ResponsiveDialog", () => {
  it("celular: painel inferior; Esc fecha e devolve o foco", async () => {
    render(<DialogHarness />);
    const trigger = screen.getByRole("button", { name: "Abrir" });
    await userEvent.click(trigger);
    const dialog = await screen.findByRole("dialog", { name: "Filtros" });
    expect(dialog).toHaveAttribute("data-slot", "sheet-content");
    expect(document.querySelector("[data-slot=sheet-overlay]")?.className).toContain("bg-overlay");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("desktop: diálogo central", async () => {
    desktop();
    render(<DialogHarness />);
    await userEvent.click(screen.getByRole("button", { name: "Abrir" }));
    expect(await screen.findByRole("dialog", { name: "Filtros" })).toHaveAttribute(
      "data-slot",
      "dialog-content",
    );
  });

  it("gesto de voltar (popstate) fecha o diálogo", async () => {
    render(<DialogHarness />);
    await userEvent.click(screen.getByRole("button", { name: "Abrir" }));
    await screen.findByRole("dialog");
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});

describe("notify", () => {
  it("avisos duram ≥ 5 s", () => {
    const success = vi.spyOn(toast, "success");
    const error = vi.spyOn(toast, "error");
    const info = vi.spyOn(toast, "info");
    notify.success("Transação salva.");
    notify.error("Não foi possível salvar.");
    notify.info("Sincronização iniciada.");
    for (const spy of [success, error, info]) {
      const options = spy.mock.calls[0][1] as { duration: number };
      expect(options.duration).toBeGreaterThanOrEqual(5000);
    }
  });

  it("desfazer fica até ser dispensado e chama a ação", async () => {
    const spy = vi.spyOn(toast, "message");
    const onUndo = vi.fn();
    notify.undo("Transação excluída.", onUndo);
    const options = spy.mock.calls[0][1] as {
      duration: number;
      action: { label: string; onClick: () => void };
    };
    expect(options.duration).toBe(Number.POSITIVE_INFINITY);
    expect(options.action.label).toBe("Desfazer");
    await options.action.onClick();
    expect(onUndo).toHaveBeenCalledOnce();
  });

  it("desfazer sem conexão não chama a ação e avisa", async () => {
    vi.spyOn(toast, "message");
    const error = vi.spyOn(toast, "error");
    const onUndo = vi.fn();
    notify.undo("Transação excluída.", onUndo);
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    const options = vi.mocked(toast.message).mock.calls[0][1] as unknown as {
      action: { onClick: () => Promise<void> };
    };
    await options.action.onClick();
    expect(onUndo).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(
      "Sem conexão: nada foi salvo. Tente de novo quando a conexão voltar.",
      expect.anything(),
    );
  });

  it("avisos são anunciados (região viva do Toaster)", async () => {
    render(<Toaster />);
    act(() => notify.success("Transação salva."));
    expect(await screen.findByText("Transação salva.")).toBeInTheDocument();
    expect(document.querySelector("[aria-live]")).not.toBeNull();
  });
});
