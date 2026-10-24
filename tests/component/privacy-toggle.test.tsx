import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Money } from "@/components/finance/money";
import { PreferencesProvider } from "@/components/shell/preferences-provider";
import { PrivacyToggle } from "@/components/shell/privacy-toggle";
import { PrivacySwitch } from "@/components/shell/privacy-switch";

/** FR-031 — ocultar valores pelo cabeçalho e pelos Ajustes, lembrado no aparelho. */
afterEach(() => {
  vi.restoreAllMocks();
  delete document.documentElement.dataset.privacy;
  document.cookie = "prumo_privacy=; Max-Age=0; Path=/";
});

describe("PrivacyToggle", () => {
  it("alterna rótulo, aria-pressed, atributo do <html> e cookie", async () => {
    render(<PrivacyToggle />);
    const button = screen.getByRole("button", { name: "Ocultar valores" });
    expect(button).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(button);
    expect(screen.getByRole("button", { name: "Mostrar valores" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(document.documentElement.dataset.privacy).toBe("on");
    expect(document.cookie).toContain("prumo_privacy=on");
    await userEvent.click(screen.getByRole("button", { name: "Mostrar valores" }));
    expect(document.documentElement.dataset.privacy).toBeUndefined();
    expect(document.cookie).toContain("prumo_privacy=off");
  });

  it("cookie bloqueado: vale na sessão, sem erro", async () => {
    vi.spyOn(document, "cookie", "set").mockImplementation(() => {
      throw new DOMException("bloqueado", "SecurityError");
    });
    render(<PrivacyToggle />);
    await userEvent.click(screen.getByRole("button", { name: "Ocultar valores" }));
    expect(document.documentElement.dataset.privacy).toBe("on");
  });

  it("cabeçalho e Ajustes compartilham o mesmo estado", async () => {
    render(
      <PreferencesProvider initialTheme="auto" initialPrivacy="off">
        <PrivacyToggle />
        <PrivacySwitch />
      </PreferencesProvider>,
    );
    const toggle = screen.getByRole("switch", { name: "Ocultar valores" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    await userEvent.click(screen.getByRole("button", { name: "Ocultar valores" }));
    expect(toggle).toHaveAttribute("aria-checked", "true");
    await userEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Ocultar valores" })).toBeInTheDocument();
  });

  it("valores exibidos ganham a máscara (CSS por data-privacy)", () => {
    const { container } = render(<Money cents={-4590} />);
    expect(container.querySelector("[data-money-mask]")).toHaveTextContent("R$ ••••");
    expect(container.querySelector("[data-money-mask]")).toHaveTextContent("valor oculto");
  });
});
