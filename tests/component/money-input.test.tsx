import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DateInput } from "@/components/forms/date-input";
import { MoneyInput } from "@/components/forms/money-input";
import { SelectField } from "@/components/forms/select-field";
import { SwitchField } from "@/components/forms/switch-field";
import { TextareaField } from "@/components/forms/textarea-field";
import { TodayProvider } from "@/components/shell/today-provider";
import { DATASET } from "./helpers/synthetic";
import { Harness } from "./helpers/form-harness";

/** contracts/components.md §4 — FR-039, FR-044. */
const realMatchMedia = window.matchMedia;
afterEach(() => {
  window.matchMedia = realMatchMedia;
});

function desktop() {
  window.matchMedia = (query: string) =>
    ({ ...realMatchMedia(query), matches: query.includes("min-width") }) as MediaQueryList;
}

function errorOf(input: HTMLElement): HTMLElement | null {
  const ids = (input.getAttribute("aria-describedby") ?? "").split(" ");
  const id = ids.find((value) => value.endsWith("-error"));
  return id ? document.getElementById(id) : null;
}

describe("MoneyInput", () => {
  it("formata no blur e entrega centavos exatos com o sinal da direção", async () => {
    const onSubmit = vi.fn();
    render(
      <Harness defaults={{ valor: undefined }} onSubmit={onSubmit}>
        <MoneyInput name="valor" label="Valor" direction="expense" />
      </Harness>,
    );
    const input = screen.getByLabelText("Valor");
    expect(input).toHaveAttribute("inputmode", "decimal");
    await userEvent.type(input, "1.234,5");
    await userEvent.tab();
    expect(input).toHaveValue("R$ 1.234,50");
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ valor: -123450 }));
  });

  it("seletor Entrada/Saída quando a direção é escolhida pelo usuário", async () => {
    const onSubmit = vi.fn();
    render(
      <Harness defaults={{ valor: undefined }} onSubmit={onSubmit}>
        <MoneyInput name="valor" label="Valor" direction="choose" />
      </Harness>,
    );
    await userEvent.click(screen.getByRole("radio", { name: "Entrada" }));
    await userEvent.type(screen.getByLabelText("Valor"), "1234,5");
    await userEvent.tab();
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ valor: 123450 }));
  });

  it("erro em português junto ao campo", async () => {
    render(
      <Harness defaults={{ valor: undefined }}>
        <MoneyInput name="valor" label="Valor" direction="expense" />
      </Harness>,
    );
    const input = screen.getByLabelText("Valor");
    await userEvent.type(input, "12,345");
    await userEvent.tab();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(errorOf(input)).toHaveTextContent("Use no máximo 2 casas decimais.");
  });

  it("mostra o digitado mesmo no modo privacidade (não é um valor exibido)", () => {
    document.documentElement.dataset.privacy = "on";
    const { container } = render(
      <Harness defaults={{ valor: undefined }}>
        <MoneyInput name="valor" label="Valor" direction="expense" />
      </Harness>,
    );
    expect(container.querySelector("[data-money]")).toBeNull();
    delete document.documentElement.dataset.privacy;
  });
});

describe("DateInput", () => {
  it("atalhos Hoje e Ontem no fuso de São Paulo", async () => {
    render(
      <TodayProvider today="2026-09-30" fixed>
        <Harness defaults={{ data: "" }}>
          <DateInput name="data" label="Data" />
        </Harness>
      </TodayProvider>,
    );
    const input = screen.getByLabelText("Data");
    expect(input).toHaveAttribute("type", "date");
    await userEvent.click(screen.getByRole("button", { name: "Ontem" }));
    expect(input).toHaveValue("2026-09-29");
    await userEvent.click(screen.getByRole("button", { name: "Hoje" }));
    expect(input).toHaveValue("2026-09-30");
  });
});

describe("SelectField", () => {
  const few = DATASET.accounts.slice(0, 3).map((a) => ({ value: a.id, label: a.name }));
  const many = DATASET.transactions
    .filter((t, i, all) => all.findIndex((u) => u.description === t.description) === i)
    .slice(0, 9)
    .map((t) => ({ value: t.id, label: t.description }));

  it("até 7 opções: seleção nativa", async () => {
    render(
      <Harness defaults={{ conta: "" }}>
        <SelectField name="conta" label="Conta" options={few} />
      </Harness>,
    );
    const select = screen.getByRole("combobox", { name: "Conta" });
    await userEvent.selectOptions(select, few[1].value);
    expect(select).toHaveValue(few[1].value);
  });

  it("mais de 7 opções no celular: painel inferior com busca", async () => {
    render(
      <Harness defaults={{ item: "" }}>
        <SelectField name="item" label="Item" options={many} />
      </Harness>,
    );
    await userEvent.click(screen.getByRole("button", { name: /Item/ }));
    const dialog = await screen.findByRole("dialog", { name: "Item" });
    expect(dialog).toHaveAttribute("data-slot", "sheet-content");
    await userEvent.type(within(dialog).getByRole("searchbox"), many[4].label);
    expect(within(dialog).getAllByRole("radio").length).toBeGreaterThanOrEqual(1);
    await userEvent.click(within(dialog).getByRole("radio", { name: many[4].label }));
    expect(screen.getByRole("button", { name: /Item/ })).toHaveTextContent(many[4].label);
  });

  it("mais de 7 opções no desktop: diálogo central", async () => {
    desktop();
    render(
      <Harness defaults={{ item: "" }}>
        <SelectField name="item" label="Item" options={many} />
      </Harness>,
    );
    await userEvent.click(screen.getByRole("button", { name: /Item/ }));
    expect(await screen.findByRole("dialog", { name: "Item" })).toHaveAttribute(
      "data-slot",
      "dialog-content",
    );
  });
});

describe("SwitchField", () => {
  it("rótulo clicável e estado anunciado", async () => {
    render(
      <Harness defaults={{ ativo: false }}>
        <SwitchField name="ativo" label="Lembrar escolha" help="Vale para este aparelho." />
      </Harness>,
    );
    const toggle = screen.getByRole("switch", { name: "Lembrar escolha" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    await userEvent.click(screen.getByText("Lembrar escolha"));
    expect(toggle).toHaveAttribute("aria-checked", "true");
  });
});

describe("TextareaField", () => {
  it("contador anunciado ao se aproximar do limite", async () => {
    render(
      <Harness defaults={{ nota: "" }}>
        <TextareaField name="nota" label="Observação" maxLength={20} />
      </Harness>,
    );
    const area = screen.getByLabelText("Observação");
    await userEvent.type(area, "abc");
    expect(screen.getByText("3/20")).toBeInTheDocument();
    expect(screen.queryByText(/Restam/)).toBeNull();
    await userEvent.type(area, "defghijklmnopqr");
    expect(screen.getByText("Restam 2 caracteres.")).toBeInTheDocument();
  });
});
