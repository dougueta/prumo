import { ComingSoon } from "@/components/shell/coming-soon";
import { PageHeader } from "@/components/shell/page-header";

export const metadata = { title: "Planejamento · Prumo" };

/** /planejamento — "em breve" até a feature dona existir (contracts/navigation.md §3). */
export default function PlanejamentoPage() {
  return (
    <>
      <PageHeader title="Planejamento" />
      <ComingSoon
        title="Planejamento"
        description="Cartões e faturas, parcelamentos, orçamento, metas e projeção chegam numa próxima versão do Prumo."
      />
    </>
  );
}
