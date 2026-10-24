import { Skeleton } from "@/components/ui/skeleton";

/**
 * Esqueleto com o formato aproximado do conteúdo final (FR-037): sem "pulos" de layout.
 * Contêiner ocupado (`aria-busy`) e anúncio "Carregando…" para leitor de tela.
 */
export function LoadingSkeleton({
  variant,
  rows = 3,
}: {
  variant: "list" | "card" | "page" | "text";
  rows?: number;
}) {
  return (
    <div aria-busy="true" className="flex flex-col gap-3">
      <span className="sr-only">Carregando…</span>
      {variant === "page" && (
        <>
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-28 rounded-lg" />
          <Skeleton className="h-28 rounded-lg" />
        </>
      )}
      {variant === "card" && (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-8 w-2/3" />
        </div>
      )}
      {variant === "list" &&
        Array.from({ length: rows }, (_, i) => (
          <div key={i} data-slot="skeleton-row" className="flex items-center gap-3 py-2">
            <Skeleton className="size-10 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      {variant === "text" &&
        Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} data-slot="skeleton-row" className="h-4 w-full" />
        ))}
    </div>
  );
}
