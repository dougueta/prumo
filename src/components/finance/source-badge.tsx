"use client";

import { Bot, BookCheck, Building2, Hand } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** Origem/confiança da categorização (FR-035, Constitution VI). Limiares de confiança: 014. */
export type SourceBadgeData =
  | { origin: "manual" }
  | { origin: "rule"; ruleName?: string }
  | { origin: "ai"; confidence: "high" | "medium" | "low" }
  | { origin: "source"; sourceName?: string };

export type SourceBadgeProps = SourceBadgeData & { onCorrect?: () => void };

const CONFIDENCE = { high: "alta", medium: "média", low: "baixa" } as const;

function describe(data: SourceBadgeData): { label: string; explanation: string; tone: string } {
  switch (data.origin) {
    case "manual":
      return {
        label: "Manual",
        explanation: "Categoria definida por você. A IA nunca muda uma escolha manual.",
        tone: "bg-surface-muted text-foreground",
      };
    case "rule":
      return {
        label: "Regra",
        explanation: data.ruleName
          ? `Categoria aplicada pela regra "${data.ruleName}".`
          : "Categoria aplicada por uma regra sua.",
        tone: "bg-primary-subtle text-primary",
      };
    case "source":
      return {
        label: "Fonte",
        explanation: data.sourceName
          ? `Categoria informada por ${data.sourceName}.`
          : "Categoria informada pela instituição.",
        tone: "bg-info-subtle text-info",
      };
    case "ai": {
      const level = CONFIDENCE[data.confidence];
      return {
        label: data.confidence === "low" ? "IA · revisar" : `IA · confiança ${level}`,
        explanation: `Categoria sugerida pela IA com confiança ${level}. Você pode corrigir — sua correção vira regra.`,
        tone: data.confidence === "low" ? "bg-warning-subtle text-warning" : "bg-ai-subtle text-ai",
      };
    }
  }
}

const ICONS = { manual: Hand, rule: BookCheck, source: Building2, ai: Bot } as const;

/**
 * Selo de origem da categoria: Manual, Regra, Fonte ou IA (com confiança). Toque explica a
 * origem e oferece "Corrigir" quando houver `onCorrect`.
 */
export function SourceBadge({ onCorrect, ...data }: SourceBadgeProps) {
  const { label, explanation, tone } = describe(data);
  const Icon = ICONS[data.origin];
  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          // Pílula de 24px com área de toque de 44px (FR-021) via pseudo-elemento.
          "relative inline-flex min-h-6 items-center gap-1 rounded-full px-2 text-xs font-medium after:absolute after:-inset-2.5",
          tone,
        )}
      >
        <Icon aria-hidden="true" className="size-3" />
        {label}
        <span className="sr-only">: ver origem da categoria</span>
      </PopoverTrigger>
      <PopoverContent className="flex flex-col gap-3 text-sm">
        <p>{explanation}</p>
        {onCorrect && (
          <Button variant="secondary" size="sm" onClick={onCorrect}>
            Corrigir
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
