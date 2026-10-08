"use client";

import { useController } from "react-hook-form";
import { Switch } from "@/components/ui/switch";
import { FormField } from "./form-field";

/** Alternância (FR-039): rótulo clicável, estado anunciado (`role="switch"` + `aria-checked`). */
export function SwitchField({ name, label, help }: { name: string; label: string; help?: string }) {
  const { field } = useController({ name });
  return (
    <FormField name={name} label={label} help={help}>
      {(a11y) => (
        <Switch
          {...a11y}
          ref={field.ref}
          name={field.name}
          checked={Boolean(field.value)}
          onCheckedChange={(checked) => field.onChange(checked)}
          onBlur={field.onBlur}
        />
      )}
    </FormField>
  );
}
