"use client";

import { Button } from "@/components/ui/button";

/** Erro numa página do shell: texto padrão, sem detalhe técnico (FR-038). */
export default function RouteError({ retry, reset }: { retry?: () => void; reset?: () => void }) {
  return (
    <section className="mt-6 flex flex-col items-center gap-3 rounded-lg border border-border bg-surface px-6 py-12 text-center">
      <h2 className="text-lg font-semibold">Não foi possível carregar.</h2>
      <p className="text-foreground-muted">Verifique sua conexão e tente de novo.</p>
      <Button variant="secondary" onClick={() => (retry ?? reset)?.()}>
        Tentar novamente
      </Button>
    </section>
  );
}
