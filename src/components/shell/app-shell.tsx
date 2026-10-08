import type { ReactNode } from "react";
import { BottomNav } from "./bottom-nav";
import { OfflineBanner } from "./offline-banner";
import { SideNav } from "./side-nav";
import { SkipLink } from "./skip-link";

/**
 * Moldura das telas do app (contracts/navigation.md §4): atalho de conteúdo, menu lateral
 * (≥ md), conteúdo com largura máxima legível (FR-016) e barra inferior (< md).
 * Selo de demonstração, indicador de ambiente e avisos ficam no root layout.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1">
      <SkipLink />
      <SideNav />
      <div className="flex min-w-0 flex-1 flex-col">
        <OfflineBanner />
        <main
          id="conteudo"
          tabIndex={-1}
          className="mx-auto w-full max-w-content flex-1 px-4 pb-28 outline-none md:px-8 md:pb-10"
        >
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
