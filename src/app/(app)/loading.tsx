import { LoadingSkeleton } from "@/components/states/loading-skeleton";

/** Carregamento de rota do shell: esqueleto imediato (contracts/navigation.md §5). */
export default function Loading() {
  return (
    <div className="py-4">
      <LoadingSkeleton variant="page" />
    </div>
  );
}
