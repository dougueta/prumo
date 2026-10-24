"use client";

import "./globals.css";

/**
 * Erro no root layout ou em (app)/layout (o error.tsx do segmento não captura o próprio
 * layout). Documento próprio, pt-BR, textos padrão, nunca detalhes técnicos (FR-038).
 */
export default function GlobalError({
  retry,
  reset,
}: {
  error?: Error & { digest?: string };
  retry?: () => void;
  reset?: () => void;
}) {
  return (
    <html lang="pt-BR">
      <body className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background px-6 text-center text-foreground">
        <title>Algo deu errado · Prumo</title>
        <h1 className="text-2xl font-semibold">Algo deu errado.</h1>
        <p className="text-foreground-muted">Tente de novo em instantes.</p>
        <button
          type="button"
          onClick={() => (retry ?? reset)?.()}
          className="min-h-11 rounded-md bg-primary px-4 font-medium text-primary-foreground"
        >
          Tentar novamente
        </button>
      </body>
    </html>
  );
}
