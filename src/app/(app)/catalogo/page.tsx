import { CatalogSearch } from "@/catalog/catalog-search";
import { FOUNDATIONS } from "@/catalog/foundations";
import { CATALOG, GROUP_LABELS } from "@/catalog/registry";
import { PageHeader } from "@/components/shell/page-header";

export const metadata = { title: "Catálogo · Prumo" };

/** /catalogo — índice com busca, por grupo (contracts/catalog.md §1). */
export default function CatalogIndexPage() {
  const componentGroups = (Object.keys(GROUP_LABELS) as (keyof typeof GROUP_LABELS)[]).map(
    (group) => ({
      label: GROUP_LABELS[group],
      links: CATALOG.filter((entry) => entry.group === group).map((entry) => ({
        href: `/catalogo/${entry.slug}`,
        name: entry.name,
        description: entry.description,
        group,
      })),
    }),
  );
  const groups = [
    {
      label: "Fundamentos",
      links: FOUNDATIONS.map((f) => ({
        href: `/catalogo/fundamentos/${f.topic}`,
        name: f.name,
        description: f.description,
        group: "fundamentos",
      })),
    },
    ...componentGroups,
    {
      label: "Guia de escrita e exemplo",
      links: [
        {
          href: "/catalogo/escrita",
          name: "Guia de escrita",
          description: "Tom de voz, termos e textos padrão.",
          group: "escrita",
        },
        {
          href: "/catalogo/exemplo-extrato",
          name: "Tela de exemplo: extrato",
          description: "Uma tela montada só com componentes do catálogo.",
          group: "escrita",
        },
      ],
    },
  ];

  return (
    <>
      <PageHeader title="Catálogo" back="/mais" />
      <p className="mb-6 text-foreground-muted">
        Referência única do design system do Prumo: fundamentos, componentes e regras de uso. Só
        existe fora da produção. Exemplos com dados fictícios.
      </p>
      <CatalogSearch groups={groups} />
    </>
  );
}
