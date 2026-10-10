import { PageHeader } from "@/components/shell/page-header";
import { PrivacySwitch } from "@/components/shell/privacy-switch";
import { ThemeSelect } from "@/components/shell/theme-select";

export const metadata = { title: "Ajustes · Prumo" };

/** /mais/ajustes — tema e ocultar valores (FR-017, FR-031). Preferências ficam neste aparelho. */
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
        <section aria-labelledby="ajustes-privacidade" className="flex flex-col gap-3">
          <h2 id="ajustes-privacidade" className="text-lg font-semibold">
            Privacidade
          </h2>
          <PrivacySwitch />
        </section>
      </div>
    </>
  );
}
