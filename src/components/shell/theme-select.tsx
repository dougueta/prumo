"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useId } from "react";
import type { ThemePreference } from "@/lib/preferences";
import { usePreferences } from "./preferences-provider";

const OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "auto", label: "Automático", icon: Monitor },
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Escuro", icon: Moon },
];

/**
 * Escolha de tema (FR-017, FR-018): Automático segue o sistema; Claro/Escuro fixam. Aplica na
 * hora (atributo do <html> + metas theme-color) e lembra no aparelho (cookie).
 */
export function ThemeSelect() {
  const { theme, setTheme } = usePreferences();
  const name = useId();
  return (
    <div role="radiogroup" aria-label="Tema" className="grid grid-cols-3 gap-2">
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <label
          key={value}
          className="flex min-h-11 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-border-strong bg-surface px-2 py-2 text-sm font-medium transition-colors duration-fast has-checked:border-primary has-checked:bg-primary-subtle has-checked:text-primary has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus"
        >
          <input
            type="radio"
            name={name}
            value={value}
            checked={theme === value}
            onChange={() => setTheme(value)}
            className="sr-only"
          />
          <Icon aria-hidden="true" className="size-5" />
          {label}
        </label>
      ))}
    </div>
  );
}
