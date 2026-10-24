"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type DefaultValues, type FieldValues } from "react-hook-form";
import type { z } from "zod";

/**
 * Formulário padrão do Prumo (FR-040, research R-10): valida ao sair do campo e no envio
 * (`onTouched`), leva o foco ao primeiro erro e usa o schema zod da feature.
 */
export function useAppForm<T extends FieldValues>(
  schema: z.ZodType<T, FieldValues>,
  defaults: DefaultValues<T> | Record<string, unknown>,
) {
  return useForm<T>({
    resolver: zodResolver(schema as never),
    defaultValues: defaults as DefaultValues<T>,
    mode: "onTouched",
    shouldFocusError: true,
  });
}
