import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { Form, TextField } from "@/components/forms/form-field";
import { MoneyInput } from "@/components/forms/money-input";
import { SubmitButton } from "@/components/forms/submit-button";
import { useAppForm } from "@/components/forms/use-app-form";
import { Toaster } from "@/components/ui/sonner";

/** contracts/components.md §4 — FR-040, FR-041; edge cases "duplo envio" e "offline". */
const OFFLINE = "Sem conexão: nada foi salvo. Tente de novo quando a conexão voltar.";

const schema = z.object({
  descricao: z.string().min(1, "Informe a descrição."),
  valor: z.number({ error: "Informe um valor." }).int(),
});

function Example({ action }: { action: (values: z.infer<typeof schema>) => Promise<unknown> }) {
  const form = useAppForm(schema, { descricao: "", valor: undefined });
  return (
    <>
      <Form form={form} onSubmit={action}>
        <TextField name="descricao" label="Descrição" />
        <MoneyInput name="valor" label="Valor" direction="expense" />
        <SubmitButton>Salvar</SubmitButton>
      </Form>
      <Toaster />
    </>
  );
}

function setOnline(value: boolean) {
  Object.defineProperty(navigator, "onLine", { configurable: true, value });
}

afterEach(() => setOnline(true));

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Descrição"), "Exemplo");
  await user.type(screen.getByLabelText("Valor"), "10,00");
  await user.tab();
}

describe("formulário padrão", () => {
  it("valida ao sair do campo, com erro anunciado junto ao campo", async () => {
    const user = userEvent.setup();
    render(<Example action={vi.fn()} />);
    const field = screen.getByLabelText("Descrição");
    await user.click(field);
    await user.tab();
    expect(field).toHaveAttribute("aria-invalid", "true");
    const errorId = (field.getAttribute("aria-describedby") ?? "")
      .split(" ")
      .find((id) => id.endsWith("-error"));
    const error = document.getElementById(errorId ?? "");
    expect(error).toHaveTextContent("Informe a descrição.");
    expect(error).toHaveAttribute("role", "alert");
  });

  it("no envio inválido, foca o primeiro campo com erro", async () => {
    const user = userEvent.setup();
    const action = vi.fn();
    render(<Example action={action} />);
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(screen.getByLabelText("Descrição")).toHaveFocus());
    expect(action).not.toHaveBeenCalled();
  });

  it("ignora duplo envio: botão fica 'enviando' até concluir", async () => {
    const user = userEvent.setup();
    let resolve: () => void = () => {};
    const action = vi.fn(() => new Promise<void>((r) => (resolve = r)));
    render(<Example action={action} />);
    await fillValid(user);
    const button = screen.getByRole("button", { name: "Salvar" });
    await user.click(button);
    await waitFor(() => expect(button).toHaveAttribute("aria-busy", "true"));
    await user.click(button);
    expect(action).toHaveBeenCalledTimes(1);
    resolve();
    await waitFor(() => expect(button).not.toHaveAttribute("aria-busy"));
  });

  it("offline: não chama a ação, botão volta ao normal e avisa que nada foi salvo", async () => {
    const user = userEvent.setup();
    const action = vi.fn();
    render(<Example action={action} />);
    await fillValid(user);
    setOnline(false);
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText(OFFLINE)).toBeInTheDocument();
    expect(action).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Salvar" })).not.toBeDisabled();
  });

  it("ação rejeitada por falha de rede: mesma mensagem", async () => {
    const user = userEvent.setup();
    const action = vi.fn(() => Promise.reject(new TypeError("Failed to fetch")));
    render(<Example action={action} />);
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText(OFFLINE)).toBeInTheDocument();
  });
});
