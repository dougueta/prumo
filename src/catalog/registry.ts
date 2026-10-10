import { ESTADOS } from "./entries/estados";
import { FINANCAS } from "./entries/financas";
import { FORMULARIOS } from "./entries/formularios";
import { SHELL } from "./entries/shell";
import type { CatalogEntry } from "./types";

export type { CatalogEntry, CatalogExample } from "./types";
export { GROUP_LABELS } from "./types";

/**
 * Registro do catálogo (contracts/catalog.md §2): toda peça pública de finance/states/forms/shell
 * tem página com regras de uso. Testado em tests/unit/catalog-registry.test.ts.
 */
export const CATALOG: CatalogEntry[] = [...FINANCAS, ...ESTADOS, ...FORMULARIOS, ...SHELL];

/** Módulos sem página própria: hooks, providers e detalhes internos. */
export const CATALOG_EXEMPT = [
  "@/components/shell/today-provider",
  "@/components/shell/preferences-provider",
  "@/components/shell/use-back-to-close",
  "@/components/shell/use-media-query",
  "@/components/shell/app-toaster",
];

export function catalogEntry(slug: string): CatalogEntry | undefined {
  return CATALOG.find((entry) => entry.slug === slug);
}
