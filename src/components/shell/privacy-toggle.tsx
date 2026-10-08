"use client";

import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePreferences } from "./preferences-provider";

/** Botão de "olho" do cabeçalho: oculta/mostra todos os valores do app (FR-031, US5). */
export function PrivacyToggle() {
  const { privacy, setPrivacy } = usePreferences();
  const on = privacy === "on";
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-pressed={on}
      aria-label={on ? "Mostrar valores" : "Ocultar valores"}
      onClick={() => setPrivacy(on ? "off" : "on")}
    >
      {on ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
    </Button>
  );
}
