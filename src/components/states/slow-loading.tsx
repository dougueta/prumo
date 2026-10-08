"use client";

import { Clock } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

/**
 * Carregamento demorado (FR-037): depois de `thresholdMs` (10 s), troca o esqueleto por
 * "Está demorando mais que o normal." com nova tentativa — nunca carrega indefinidamente.
 */
export function SlowLoading({
  startedAt,
  thresholdMs = 10_000,
  onRetry,
  children,
}: {
  /** Instante (ms) em que o carregamento começou; padrão = montagem. */
  startedAt?: number;
  thresholdMs?: number;
  onRetry: () => void;
  /** Esqueleto exibido enquanto não passa do limite. */
  children: ReactNode;
}) {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const elapsed = startedAt === undefined ? 0 : Date.now() - startedAt;
    const timer = setTimeout(() => setSlow(true), Math.max(0, thresholdMs - elapsed));
    return () => clearTimeout(timer);
  }, [startedAt, thresholdMs]);

  if (!slow) return <>{children}</>;
  return (
    <section
      role="status"
      className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface px-6 py-10 text-center"
    >
      <Clock aria-hidden="true" className="size-6 text-warning" />
      <p className="font-medium">Está demorando mais que o normal.</p>
      <Button variant="secondary" onClick={onRetry}>
        Tentar novamente
      </Button>
    </section>
  );
}
