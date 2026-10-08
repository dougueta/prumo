/** Carregamento de rota do shell: esqueleto imediato (contracts/navigation.md §5). */
export default function Loading() {
  return (
    <div aria-busy="true" className="flex flex-col gap-4 py-4">
      <span className="sr-only">Carregando…</span>
      <div className="h-8 w-1/2 animate-pulse rounded-md bg-surface-muted" />
      <div className="h-24 animate-pulse rounded-lg bg-surface-muted" />
      <div className="h-24 animate-pulse rounded-lg bg-surface-muted" />
    </div>
  );
}
