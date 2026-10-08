import { Logo } from "@/components/brand/logo";
import { EmptyState } from "@/components/states/empty-state";

export const metadata = { title: "Página não encontrada · Prumo" };

/**
 * URL inexistente (404 raiz, fora do shell): pt-BR, com tokens, tema e selo de demonstração
 * do root layout — nunca a página padrão em inglês (contracts/navigation.md §5).
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-4 py-12">
      <Logo className="text-primary" />
      <EmptyState
        headingLevel={1}
        title="Página não encontrada"
        description="O endereço pode ter mudado."
        action={{ label: "Voltar ao início", href: "/" }}
      />
    </main>
  );
}
