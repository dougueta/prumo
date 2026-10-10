import type { ReactNode } from "react";

/** Registro do catálogo (contracts/catalog.md §2). */
export type CatalogExample = {
  title: string;
  render: () => ReactNode;
  /** "do" = jeito certo; "dont" = jeito errado (com explicação em `note`). */
  kind?: "do" | "dont";
  note?: string;
};

export type CatalogEntry = {
  slug: string;
  name: string;
  group: "financas" | "estados" | "formularios" | "shell";
  description: string;
  /** Import principal mostrado na página. */
  importPath: string;
  /** Outros módulos documentados nesta mesma página. */
  alsoCovers?: string[];
  whenToUse: string[];
  whenNotToUse: string[];
  a11y: string[];
  texts?: Record<string, string>;
  examples: CatalogExample[];
  /** Variantes/estados exibidos (cada um tem um exemplo com o mesmo título). */
  states: string[];
};

export const GROUP_LABELS: Record<CatalogEntry["group"], string> = {
  financas: "Finanças",
  estados: "Estados",
  formularios: "Formulários e ações",
  shell: "Shell",
};
