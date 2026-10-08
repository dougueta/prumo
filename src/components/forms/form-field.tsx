"use client";

import { useId, type ReactNode } from "react";
import {
  FormProvider,
  get,
  useFormContext,
  useFormState,
  type FieldValues,
  type UseFormReturn,
} from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { runOnline } from "./run-online";

/**
 * Formulário com o comportamento padrão (FR-040): `noValidate` (erros nossos, em português),
 * envio pelo `handleSubmit` do react-hook-form e ação protegida por `runOnline` — sem conexão
 * nada é enviado e o usuário é avisado.
 */
export function Form<T extends FieldValues>({
  form,
  onSubmit,
  className,
  children,
}: {
  form: UseFormReturn<T>;
  onSubmit: (values: T) => unknown | Promise<unknown>;
  className?: string;
  children: ReactNode;
}) {
  return (
    <FormProvider {...form}>
      <form
        noValidate
        className={cn("flex flex-col gap-4", className)}
        onSubmit={form.handleSubmit(async (values) => {
          await runOnline(() => onSubmit(values));
        })}
      >
        {children}
      </form>
    </FormProvider>
  );
}

export type FieldA11yProps = {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
};

/**
 * Moldura de campo (FR-039): rótulo, ajuda opcional e erro junto ao campo, ligados por
 * `aria-describedby`/`aria-invalid`. `children` recebe as props de acessibilidade do controle.
 */
export function FormField({
  name,
  label,
  help,
  error: errorOverride,
  labelAs = "label",
  children,
}: {
  name: string;
  label: string;
  help?: string;
  /** Erro calculado pelo próprio campo (ex.: valor digitado inválido). */
  error?: string;
  /** "legend" para grupos (rótulo sem controle único). */
  labelAs?: "label" | "span";
  children: (field: FieldA11yProps) => ReactNode;
}) {
  const id = useId();
  const { errors } = useFormState({ name });
  const error: string | undefined = errorOverride ?? get(errors, name)?.message;
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  const describedBy = [help && helpId, error && errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      {labelAs === "label" ? (
        <Label htmlFor={id}>{label}</Label>
      ) : (
        <span id={`${id}-label`} className="text-sm font-medium">
          {label}
        </span>
      )}
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {help && (
        <p id={helpId} className="text-sm text-foreground-muted">
          {help}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/** Campo de texto padrão. */
export function TextField({
  name,
  label,
  help,
  type = "text",
  autoComplete,
}: {
  name: string;
  label: string;
  help?: string;
  type?: "text" | "email" | "search" | "tel" | "url";
  autoComplete?: string;
}) {
  const { register } = useFormContext();
  return (
    <FormField name={name} label={label} help={help}>
      {(a11y) => (
        <Input
          {...a11y}
          {...register(name)}
          type={type}
          autoComplete={autoComplete}
          className="min-h-11"
        />
      )}
    </FormField>
  );
}
