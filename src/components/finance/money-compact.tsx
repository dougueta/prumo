"use client";

import type { ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** Valor compacto acionável: toque/foco abre o valor completo (FR-026). Uso interno do Money. */
export function MoneyCompact({
  full,
  speech,
  children,
}: {
  full: string;
  speech: string;
  children: ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger
        aria-label={speech}
        className="cursor-help rounded-sm underline decoration-dotted underline-offset-4"
      >
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-auto px-3 py-2 text-sm tabular-nums">{full}</PopoverContent>
    </Popover>
  );
}
