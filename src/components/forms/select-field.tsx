"use client";

import { ChevronDown, type LucideIcon } from "lucide-react";
import { useId, useState } from "react";
import { useController } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { FormField } from "./form-field";
import { ResponsiveDialog } from "./responsive-dialog";

export type SelectOption = { value: string; label: string; icon?: LucideIcon };

/** Acima deste número de opções, a seleção vira lista com busca (FR-044). */
const MAX_NATIVE_OPTIONS = 7;

const control =
  "flex min-h-11 w-full items-center justify-between gap-2 rounded-md border border-border-strong bg-surface px-3 text-left text-base aria-invalid:border-danger";

/**
 * Seleção (FR-039, FR-044): até 7 opções, `<select>` nativo; mais de 7, botão que abre uma lista
 * com busca — painel inferior no celular, diálogo central no desktop.
 */
export function SelectField({
  name,
  label,
  help,
  options,
  placeholder = "Selecione",
}: {
  name: string;
  label: string;
  help?: string;
  options: SelectOption[];
  placeholder?: string;
}) {
  const { field } = useController({ name });
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const listId = useId();
  const selected = options.find((option) => option.value === field.value);

  if (options.length <= MAX_NATIVE_OPTIONS) {
    return (
      <FormField name={name} label={label} help={help}>
        {(a11y) => (
          <select
            {...a11y}
            ref={field.ref}
            name={field.name}
            value={field.value ?? ""}
            onChange={(event) => field.onChange(event.target.value)}
            onBlur={field.onBlur}
            className={control}
          >
            <option value="" disabled>
              {placeholder}
            </option>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )}
      </FormField>
    );
  }

  const normalized = query.trim().toLocaleLowerCase("pt-BR");
  const visible = normalized
    ? options.filter((option) => option.label.toLocaleLowerCase("pt-BR").includes(normalized))
    : options;

  return (
    <FormField name={name} label={label} help={help}>
      {(a11y) => (
        <>
          <button
            {...a11y}
            ref={field.ref}
            type="button"
            aria-haspopup="dialog"
            aria-label={`${label}: ${selected?.label ?? placeholder}`}
            onClick={() => setOpen(true)}
            className={control}
          >
            <span className={cn("truncate", !selected && "text-foreground-muted")}>
              {selected?.label ?? placeholder}
            </span>
            <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-foreground-muted" />
          </button>
          <ResponsiveDialog
            open={open}
            onOpenChange={(next) => {
              setOpen(next);
              if (!next) field.onBlur();
            }}
            title={label}
          >
            <div className="flex flex-col gap-3">
              <Input
                type="search"
                aria-label={`Buscar em ${label}`}
                aria-controls={listId}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="min-h-11"
              />
              <fieldset id={listId} className="flex max-h-80 flex-col overflow-y-auto">
                <legend className="sr-only">{label}</legend>
                {visible.length === 0 && (
                  <p className="py-3 text-sm text-foreground-muted">
                    Nenhum resultado para esta busca.
                  </p>
                )}
                {visible.map(({ value, label: optionLabel, icon: Icon }) => (
                  <label
                    key={value}
                    className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 hover:bg-surface-muted has-checked:bg-primary-subtle has-checked:text-primary"
                  >
                    <input
                      type="radio"
                      name={`${name}-opcoes`}
                      value={value}
                      checked={field.value === value}
                      onChange={() => {
                        field.onChange(value);
                        setOpen(false);
                        setQuery("");
                      }}
                      className="size-4 accent-primary"
                    />
                    {Icon && <Icon aria-hidden="true" className="size-4" />}
                    {optionLabel}
                  </label>
                ))}
              </fieldset>
            </div>
          </ResponsiveDialog>
        </>
      )}
    </FormField>
  );
}
