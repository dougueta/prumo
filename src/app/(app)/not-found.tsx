import { EmptyState } from "@/components/states/empty-state";

/** notFound() chamado dentro do shell (ex.: catálogo em produção). */
export default function AppNotFound() {
  return (
    <div className="py-6">
      <EmptyState
        headingLevel={1}
        title="Página não encontrada"
        description="O endereço pode ter mudado."
        action={{ label: "Voltar ao início", href: "/" }}
      />
    </div>
  );
}
