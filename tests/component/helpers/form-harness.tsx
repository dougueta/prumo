import type { ReactNode } from "react";
import { z } from "zod";
import { Form } from "@/components/forms/form-field";
import { useAppForm } from "@/components/forms/use-app-form";

/** Monta um formulário real (react-hook-form + zod) em volta dos campos sob teste. */
export function Harness({
  schema = z.looseObject({}),
  defaults = {},
  onSubmit = () => {},
  children,
}: {
  schema?: z.ZodType<Record<string, unknown>, Record<string, unknown>>;
  defaults?: Record<string, unknown>;
  onSubmit?: (values: Record<string, unknown>) => unknown;
  children: ReactNode;
}) {
  const form = useAppForm(schema, defaults);
  return (
    <Form form={form} onSubmit={onSubmit}>
      {children}
      <button type="submit">Enviar</button>
    </Form>
  );
}
