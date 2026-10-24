import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { catalogEntry } from "@/catalog/registry";
import { PageHeader } from "@/components/shell/page-header";
import { PrivacySwitch } from "@/components/shell/privacy-switch";
import { ThemeSelect } from "@/components/shell/theme-select";

export async function generateMetadata({ params }: PageProps<"/catalogo/[slug]">) {
  const entry = catalogEntry((await params).slug);
  return { title: `${entry?.name ?? "Catálogo"} · Catálogo · Prumo` };
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="flex list-disc flex-col gap-1 pl-5">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

/** Página de componente (contracts/catalog.md §3). */
export default async function CatalogEntryPage({ params }: PageProps<"/catalogo/[slug]">) {
  const entry = catalogEntry((await params).slug);
  if (!entry) notFound();
  const states = entry.examples.filter((example) => entry.states.includes(example.title));
  const dos = entry.examples.filter((example) => example.kind === "do");
  const donts = entry.examples.filter((example) => example.kind === "dont");

  return (
    <>
      <PageHeader title={entry.name} back="/catalogo" />
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <p>{entry.description}</p>
          <code className="w-fit max-w-full overflow-x-auto rounded-md bg-surface-muted px-2 py-1 text-sm">
            import … from &quot;{entry.importPath}&quot;
          </code>
        </div>

        <section
          aria-label="Controles do catálogo"
          className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4"
        >
          <p className="text-sm font-medium">Veja os exemplos em cada tema e com valores ocultos</p>
          <ThemeSelect />
          <PrivacySwitch />
        </section>

        <Section title="Variantes e estados">
          <div className="flex flex-col gap-6">
            {states.map((example) => (
              <div key={example.title} className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold text-foreground-muted">{example.title}</h3>
                <div className="rounded-lg border border-border bg-background p-4">
                  {example.render()}
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Quando usar">
          <Bullets items={entry.whenToUse} />
        </Section>
        <Section title="Quando não usar">
          <Bullets items={entry.whenNotToUse} />
        </Section>
        <Section title="Acessibilidade">
          <Bullets items={entry.a11y} />
        </Section>
        <Section title="Textos padrão">
          {entry.texts ? (
            <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-3">
              {Object.entries(entry.texts).map(([key, text]) => (
                <div key={key} className="contents">
                  <dt className="text-sm font-medium text-foreground-muted">{key}</dt>
                  <dd className="sm:col-span-2">{text}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-foreground-muted">
              Sem textos próprios — use o guia de escrita do catálogo.
            </p>
          )}
        </Section>
        <Section title="Certo × errado">
          <ul className="flex flex-col gap-1">
            {dos.map((example) => (
              <li key={example.title}>
                <span className="font-semibold text-income">Certo:</span> veja “{example.title}” em
                Variantes e estados.
              </li>
            ))}
          </ul>
          {donts.map((example) => (
            <div key={example.title} className="flex flex-col gap-2">
              <h3 className="font-semibold text-danger">{example.title}</h3>
              {example.note && <p className="text-sm text-foreground-muted">{example.note}</p>}
              <div className="rounded-lg border border-dashed border-danger bg-background p-4">
                {example.render()}
              </div>
            </div>
          ))}
        </Section>
      </div>
    </>
  );
}
