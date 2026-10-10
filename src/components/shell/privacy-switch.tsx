"use client";

import { useId } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { usePreferences } from "./preferences-provider";

/**
 * "Ocultar valores" nos Ajustes (FR-017, FR-031): mesmo estado do botão do cabeçalho.
 * Proteção visual contra olhares por perto — os dados continuam no aparelho (research R-06).
 */
export function PrivacySwitch() {
  const { privacy, setPrivacy } = usePreferences();
  const id = useId();
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 rounded-lg border border-border bg-surface px-4 py-3">
      <div className="flex flex-col gap-1">
        <Label htmlFor={id}>Ocultar valores</Label>
        <p id={`${id}-help`} className="text-sm text-foreground-muted">
          Mostra R$ •••• no lugar de todos os valores. Os campos de digitação continuam visíveis.
        </p>
      </div>
      <Switch
        id={id}
        aria-describedby={`${id}-help`}
        checked={privacy === "on"}
        onCheckedChange={(checked) => setPrivacy(checked ? "on" : "off")}
      />
    </div>
  );
}
