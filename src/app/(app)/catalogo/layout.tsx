import { notFound } from "next/navigation";
import { connection } from "next/server";
import { CATALOG_TODAY } from "@/catalog/examples";
import { TodayProvider } from "@/components/shell/today-provider";
import { getAppEnv } from "@/lib/app-env";
import { isCatalogEnabled } from "@/lib/catalog-access";

/**
 * Catálogo do design system (contracts/catalog.md): só fora da produção (FR-046). "Hoje" fixo
 * em CATALOG_TODAY para datas relativas e screenshots estáveis (data-model §8).
 */
export default async function CatalogLayout({ children }: LayoutProps<"/catalogo">) {
  await connection();
  if (!isCatalogEnabled(getAppEnv())) notFound();
  return (
    <TodayProvider today={CATALOG_TODAY} fixed>
      {children}
    </TodayProvider>
  );
}
