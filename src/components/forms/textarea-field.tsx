"use client";

import { useFormContext, useWatch } from "react-hook-form";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "./form-field";

/**
 * Área de texto (FR-039) com contador; ao se aproximar do limite (últimos 10%), o leitor de tela
 * é avisado de quantos caracteres restam.
 */
export function TextareaField({
  name,
  label,
  help,
  maxLength,
}: {
  name: string;
  label: string;
  help?: string;
  maxLength?: number;
}) {
  const { register } = useFormContext();
  const value: unknown = useWatch({ name });
  const length = typeof value === "string" ? value.length : 0;
  const remaining = maxLength === undefined ? undefined : maxLength - length;
  const near = maxLength !== undefined && remaining !== undefined && remaining <= maxLength * 0.1;

  return (
    <FormField name={name} label={label} help={help}>
      {(a11y) => (
        <div className="flex flex-col gap-1">
          <Textarea {...a11y} {...register(name)} maxLength={maxLength} className="min-h-24" />
          {maxLength !== undefined && (
            <div className="flex justify-between gap-2 text-xs text-foreground-muted">
              <span aria-live="polite">
                {near && `Restam ${remaining} ${remaining === 1 ? "caractere" : "caracteres"}.`}
              </span>
              <span aria-hidden="true" className="tabular-nums">
                {length}/{maxLength}
              </span>
            </div>
          )}
        </div>
      )}
    </FormField>
  );
}
