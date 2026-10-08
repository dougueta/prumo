import { CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Estado de erro (FR-037, FR-038): mensagem em português, sem detalhe técnico, com "Tentar
 * novamente". `scope="block"` ocupa só o bloco que falhou (erro parcial) e é anunciado
 * (`role="alert"`); `scope="page"` é o erro de rota.
 */
export function ErrorState({
  title = "Não foi possível carregar.",
  description = "Verifique sua conexão e tente de novo.",
  onRetry,
  scope = "block",
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  scope?: "page" | "block";
}) {
  return (
    <section
      role={scope === "block" ? "alert" : undefined}
      className={cn(
        "flex flex-col items-center gap-3 rounded-lg border border-border bg-surface text-center",
        scope === "page" ? "px-6 py-12" : "px-4 py-6",
      )}
    >
      <CircleAlert aria-hidden="true" className="size-6 text-danger" />
      <p className="font-semibold">{title}</p>
      <p className="text-sm text-foreground-muted">{description}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Tentar novamente
        </Button>
      )}
    </section>
  );
}
