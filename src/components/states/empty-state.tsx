import { Inbox, SearchX, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type Action = { label: string; href?: string; onClick?: () => void };

type EmptyStateProps =
  | {
      variant?: "empty";
      title?: string;
      description?: string;
      icon?: LucideIcon;
      action?: Action;
      /** h1 quando o estado é a tela inteira (ex.: página não encontrada). */
      headingLevel?: 1 | 2;
    }
  | {
      /** Filtro sem resultado: texto próprio e "Limpar filtros" (callback obrigatório). */
      variant: "no-results";
      onClearFilters: () => void;
      title?: string;
      description?: string;
      icon?: LucideIcon;
      headingLevel?: 1 | 2;
    };

/**
 * Estado vazio (FR-037): lista sem itens × filtro sem resultado são distintos. Textos padrão
 * do guia de escrita quando não informados.
 */
export function EmptyState(props: EmptyStateProps) {
  const noResults = props.variant === "no-results";
  const Heading = props.headingLevel === 1 ? "h1" : "h2";
  const Icon = props.icon ?? (noResults ? SearchX : Inbox);
  const title =
    props.title ?? (noResults ? "Nenhum resultado para este filtro." : "Nada por aqui ainda.");
  const action: Action | undefined = noResults
    ? { label: "Limpar filtros", onClick: props.onClearFilters }
    : props.action;

  return (
    <section className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface px-6 py-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-surface-muted text-foreground-muted">
        <Icon aria-hidden="true" className="size-6" />
      </span>
      <Heading className="text-lg font-semibold">{title}</Heading>
      {props.description && <p className="max-w-sm text-foreground-muted">{props.description}</p>}
      {action &&
        (action.href ? (
          <Button asChild variant={noResults ? "secondary" : "primary"}>
            <Link href={action.href}>{action.label}</Link>
          </Button>
        ) : (
          <Button variant={noResults ? "secondary" : "primary"} onClick={action.onClick}>
            {action.label}
          </Button>
        ))}
    </section>
  );
}
