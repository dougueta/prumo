"use client";

import { ErrorState } from "@/components/states/error-state";

/**
 * Erro numa página do shell (FR-038): texto padrão, nunca `error.message`/`digest`.
 * Next 16.3 entrega `retry` (recarrega os dados); `reset` fica como alternativa.
 */
export default function RouteError({
  retry,
  reset,
}: {
  error?: Error & { digest?: string };
  retry?: () => void;
  reset?: () => void;
}) {
  return (
    <div className="py-6">
      <ErrorState scope="page" onRetry={() => (retry ?? reset)?.()} />
    </div>
  );
}
