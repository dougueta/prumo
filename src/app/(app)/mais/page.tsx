import { ChevronRight, LibraryBig, Settings, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { getAppEnv } from "@/lib/app-env";

export const metadata = { title: "Mais · Prumo" };

type Shortcut = { href: string; label: string; description: string; icon: LucideIcon };

/** /mais — só atalhos que já existem; os de features futuras ficam ocultos (FR-009). */
export default function MaisPage() {
  const shortcuts: Shortcut[] = [
    {
      href: "/mais/ajustes",
      label: "Ajustes",
      description: "Tema e ocultar valores",
      icon: Settings,
    },
  ];
  if (getAppEnv() !== "production") {
    shortcuts.push({
      href: "/catalogo",
      label: "Catálogo do design system",
      description: "Componentes e regras de uso (só fora da produção)",
      icon: LibraryBig,
    });
  }
  return (
    <>
      <PageHeader title="Mais" />
      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
        {shortcuts.map(({ href, label, description, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors duration-fast hover:bg-surface-muted"
            >
              <Icon aria-hidden="true" className="size-5 shrink-0 text-primary" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium">{label}</span>
                <span className="text-sm text-foreground-muted">{description}</span>
              </span>
              <ChevronRight aria-hidden="true" className="size-4 text-foreground-muted" />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
