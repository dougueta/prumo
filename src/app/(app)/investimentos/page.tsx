import { ComingSoon } from "@/components/shell/coming-soon";
import { PageHeader } from "@/components/shell/page-header";

export const metadata = { title: "Investimentos · Prumo" };

/** /investimentos — "em breve" até a feature dona existir (contracts/navigation.md §3). */
export default function InvestimentosPage() {
  return (
    <>
      <PageHeader title="Investimentos" />
      <ComingSoon title="Investimentos" />
    </>
  );
}
