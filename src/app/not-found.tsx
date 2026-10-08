import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Página não encontrada · Prumo" };

/**
 * URL inexistente (404 raiz, fora do shell): pt-BR, com tokens, tema e selo de demonstração
 * do root layout — nunca a página padrão em inglês (contracts/navigation.md §5).
 */
export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <Logo className="text-primary" />
      <h1 className="text-2xl font-semibold">Página não encontrada</h1>
      <p className="text-foreground-muted">O endereço pode ter mudado.</p>
      <Button asChild>
        <Link href="/">Voltar ao início</Link>
      </Button>
    </main>
  );
}
