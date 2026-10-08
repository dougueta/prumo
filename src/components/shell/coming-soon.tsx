import { Hourglass } from "lucide-react";

/**
 * Tela "em breve" padronizada para destinos sem feature implementada (FR-009). O título da
 * seção fica no PageHeader (h1); aqui, o texto padrão do guia de escrita.
 */
export function ComingSoon({
  title,
  description = "Esta seção chega numa próxima versão do Prumo.",
}: {
  title: string;
  description?: string;
}) {
  return (
    <section
      aria-label={title}
      className="mt-6 flex flex-col items-center gap-3 rounded-lg border border-border bg-surface px-6 py-12 text-center"
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-primary-subtle text-primary">
        <Hourglass aria-hidden="true" className="size-6" />
      </span>
      <h2 className="text-lg font-semibold">Em breve</h2>
      <p className="max-w-sm text-foreground-muted">{description}</p>
    </section>
  );
}
