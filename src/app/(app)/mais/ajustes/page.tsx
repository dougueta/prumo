import { PageHeader } from "@/components/shell/page-header";
import { ThemeSelect } from "@/components/shell/theme-select";

export const metadata = { title: "Ajustes · Prumo" };

/** /mais/ajustes — tema e ocultar valores (FR-017). Preferências ficam neste aparelho. */
export default function AjustesPage() {
  return (
    <>
      <PageHeader title="Ajustes" back="/mais" />
      <div className="flex flex-col gap-6">
        <section aria-labelledby="ajustes-tema" className="flex flex-col gap-3">
          <div>
            <h2 id="ajustes-tema" className="text-lg font-semibold">
              Tema
            </h2>
            <p className="text-sm text-foreground-muted">
              Automático acompanha o tema do seu aparelho.
            </p>
          </div>
          <ThemeSelect />
        </section>
      </div>
    </>
  );
}
