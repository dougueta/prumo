"use client";

import { useFormContext } from "react-hook-form";
import { useToday } from "@/components/shell/today-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addDays } from "@/lib/format";
import { FormField } from "./form-field";

/**
 * Campo de data (FR-039): `<input type="date">` nativo (teclado e calendário do aparelho) com
 * atalhos "Hoje" e "Ontem" no fuso de São Paulo. Valor: `YYYY-MM-DD`.
 */
export function DateInput({ name, label, help }: { name: string; label: string; help?: string }) {
  const { register, setValue } = useFormContext();
  const today = useToday();
  const pick = (date: string) =>
    setValue(name, date, { shouldDirty: true, shouldTouch: true, shouldValidate: true });

  return (
    <FormField name={name} label={label} help={help}>
      {(a11y) => (
        <div className="flex flex-wrap items-center gap-2">
          <Input {...a11y} {...register(name)} type="date" className="min-h-11 w-auto flex-1" />
          <Button type="button" variant="secondary" size="sm" onClick={() => pick(today)}>
            Hoje
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => pick(addDays(today, -1))}
          >
            Ontem
          </Button>
        </div>
      )}
    </FormField>
  );
}
