import { ComingSoon } from "@/components/shell/coming-soon";
import { PageHeader } from "@/components/shell/page-header";

export const metadata = { title: "Extrato · Prumo" };

/** /extrato — "em breve" até a feature dona existir (contracts/navigation.md §3). */
export default function ExtratoPage() {
  return (
    <>
      <PageHeader title="Extrato" />
      <ComingSoon title="Extrato" />
    </>
  );
}
