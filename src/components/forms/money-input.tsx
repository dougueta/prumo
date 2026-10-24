"use client";

import { useState } from "react";
import { useController } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { formatMoney, parseMoneyInput } from "@/lib/format";
import { cn } from "@/lib/utils";
import { FormField } from "./form-field";

type Direction = "income" | "expense";

/** Texto do campo: mesmo formato do Money, com espaço comum (mais fácil de editar). */
function inputText(cents: number): string {
  return formatMoney(cents, { variant: "neutral" }).replace(/ /g, " ");
}

/**
 * Campo de valor em reais (FR-039): entrada pt-BR ("1234,5", "1.234,50"), teclado numérico,
 * formata no blur e entrega ao formulário centavos inteiros exatos com o sinal da direção
 * (Entrada +, Saída −). Não usa máscara de privacidade: mostra sempre o que é digitado.
 */
export function MoneyInput({
  name,
  label,
  help,
  direction = "choose",
}: {
  name: string;
  label: string;
  help?: string;
  direction?: Direction | "choose";
}) {
  const { field } = useController({ name });
  const initial = typeof field.value === "number" ? field.value : null;
  const [text, setText] = useState(initial === null ? "" : inputText(Math.abs(initial)));
  const [chosen, setChosen] = useState<Direction>(
    initial !== null && initial > 0 ? "income" : "expense",
  );
  const [parseError, setParseError] = useState<string>();
  const current: Direction = direction === "choose" ? chosen : direction;
  const sign = current === "income" ? 1 : -1;

  function commit(nextText: string, nextDirection: Direction) {
    if (nextText.trim() === "") {
      setParseError(undefined);
      field.onChange(undefined);
      return;
    }
    const parsed = parseMoneyInput(nextText);
    if (!parsed.ok) {
      setParseError(parsed.error);
      field.onChange(undefined);
      return;
    }
    setParseError(undefined);
    setText(inputText(parsed.cents));
    field.onChange((nextDirection === "income" ? 1 : -1) * parsed.cents);
  }

  return (
    <FormField name={name} label={label} help={help} error={parseError}>
      {(a11y) => (
        <div className="flex flex-col gap-2">
          {direction === "choose" && (
            <div
              role="radiogroup"
              aria-label={`Tipo de ${label.toLowerCase()}`}
              className="flex gap-2"
            >
              {(["expense", "income"] as const).map((option) => (
                <label
                  key={option}
                  className={cn(
                    "flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border border-border-strong px-3 text-sm font-medium has-checked:border-primary has-checked:bg-primary-subtle has-checked:text-primary",
                  )}
                >
                  <input
                    type="radio"
                    name={`${name}-direcao`}
                    value={option}
                    checked={chosen === option}
                    onChange={() => {
                      setChosen(option);
                      if (text) commit(text, option);
                    }}
                    className="sr-only"
                  />
                  {option === "income" ? "Entrada" : "Saída"}
                </label>
              ))}
            </div>
          )}
          <Input
            {...a11y}
            ref={field.ref}
            name={field.name}
            inputMode="decimal"
            autoComplete="off"
            placeholder="R$ 0,00"
            value={text}
            onChange={(event) => setText(event.target.value)}
            onBlur={() => {
              commit(text, current);
              if (parseMoneyInput(text).ok || text.trim() === "") field.onBlur();
            }}
            className={cn("min-h-11 tabular-nums", sign > 0 ? "text-income" : "text-foreground")}
          />
        </div>
      )}
    </FormField>
  );
}
