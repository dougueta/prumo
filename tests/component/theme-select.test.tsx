import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeSelect } from "@/components/shell/theme-select";
import { THEME_COLOR } from "@/styles/tokens";

/** FR-017, FR-018 — tema Automático/Claro/Escuro aplicado na hora e lembrado no aparelho. */
function addMeta(media: string, content: string) {
  const meta = document.createElement("meta");
  meta.name = "theme-color";
  meta.media = media;
  meta.content = content;
  document.head.append(meta);
}

function metaContents(): string[] {
  return [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')].map((meta) =>
    meta.content.toUpperCase(),
  );
}

beforeEach(() => {
  addMeta("(prefers-color-scheme: light)", THEME_COLOR.light);
  addMeta("(prefers-color-scheme: dark)", THEME_COLOR.dark);
});

afterEach(() => {
  document.head.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.remove());
  delete document.documentElement.dataset.theme;
  document.cookie = "prumo_theme=; Max-Age=0; Path=/";
  vi.restoreAllMocks();
});

describe("ThemeSelect", () => {
  it("três opções, Automático marcado por padrão", () => {
    render(<ThemeSelect />);
    const group = screen.getByRole("radiogroup", { name: "Tema" });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Automático" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Claro" })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: "Escuro" })).not.toBeChecked();
  });

  it("Escuro aplica data-theme, grava o cookie e ajusta todas as metas theme-color", async () => {
    render(<ThemeSelect />);
    await userEvent.click(screen.getByRole("radio", { name: "Escuro" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.cookie).toContain("prumo_theme=dark");
    expect(metaContents()).toEqual([THEME_COLOR.dark, THEME_COLOR.dark]);
  });

  it("Automático remove o atributo e restaura cada meta pela mídia", async () => {
    render(<ThemeSelect />);
    await userEvent.click(screen.getByRole("radio", { name: "Claro" }));
    expect(metaContents()).toEqual([THEME_COLOR.light, THEME_COLOR.light]);
    await userEvent.click(screen.getByRole("radio", { name: "Automático" }));
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(metaContents()).toEqual([THEME_COLOR.light, THEME_COLOR.dark]);
    expect(document.cookie).toContain("prumo_theme=auto");
  });

  it("cookie bloqueado: a mudança vale na sessão, sem erro", async () => {
    vi.spyOn(document, "cookie", "set").mockImplementation(() => {
      throw new DOMException("bloqueado", "SecurityError");
    });
    render(<ThemeSelect />);
    await userEvent.click(screen.getByRole("radio", { name: "Escuro" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(screen.getByRole("radio", { name: "Escuro" })).toBeChecked();
  });
});
