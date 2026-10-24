import { ComingSoon } from "@/components/shell/coming-soon";
import { PageHeader } from "@/components/shell/page-header";

export const metadata = { title: "Início · Prumo" };

/** / — "em breve" até a feature dona existir (contracts/navigation.md §3). */
export default function InicioPage() {
  return (
    <>
      <PageHeader title="Início" />
      <ComingSoon title="Início" />
    </>
  );
}
