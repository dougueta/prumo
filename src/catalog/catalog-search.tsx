"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";
import { Input } from "@/components/ui/input";

export type CatalogLink = { href: string; name: string; description: string; group: string };

/** Índice do catálogo com busca por nome (FR-045). */
export function CatalogSearch({ groups }: { groups: { label: string; links: CatalogLink[] }[] }) {
  const [query, setQuery] = useState("");
  const id = useId();
  const q = query.trim().toLocaleLowerCase("pt-BR");
  // Busca pelo nome do componente (US6, cenário 1).
  const match = (link: CatalogLink) => !q || link.name.toLocaleLowerCase("pt-BR").includes(q);
  const visible = groups
    .map((group) => ({ ...group, links: group.links.filter(match) }))
    .filter((group) => group.links.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="text-sm font-medium">
          Buscar componente
        </label>
        <Input
          id={id}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="min-h-11"
        />
      </div>
      <p role="status" className="sr-only">
        {visible.reduce((n, g) => n + g.links.length, 0)} resultados
      </p>
      {visible.length === 0 && (
        <p className="text-foreground-muted">Nenhum resultado para esta busca.</p>
      )}
      {visible.map((group) => (
        <section
          key={group.label}
          aria-labelledby={`${id}-${group.label}`}
          className="flex flex-col gap-2"
        >
          <h2 id={`${id}-${group.label}`} className="text-lg font-semibold">
            {group.label}
          </h2>
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
            {group.links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors duration-fast hover:bg-surface-muted"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-medium">{link.name}</span>
                    <span className="line-clamp-2 text-sm text-foreground-muted">
                      {link.description}
                    </span>
                  </span>
                  <ChevronRight
                    aria-hidden="true"
                    className="size-4 shrink-0 text-foreground-muted"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
