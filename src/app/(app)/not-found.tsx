import Link from "next/link";
import { Button } from "@/components/ui/button";

/** notFound() chamado dentro do shell (ex.: catálogo em produção). */
export default function AppNotFound() {
  return (
    <section className="mt-6 flex flex-col items-center gap-3 rounded-lg border border-border bg-surface px-6 py-12 text-center">
      <h1 className="text-xl font-semibold">Página não encontrada</h1>
      <p className="text-foreground-muted">O endereço pode ter mudado.</p>
      <Button asChild>
        <Link href="/">Voltar ao início</Link>
      </Button>
    </section>
  );
}
