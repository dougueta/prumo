import type { AppEnv } from "@/lib/env";

/** O catálogo do design system existe só em `local` e `preview` (FR-046). */
export function isCatalogEnabled(appEnv: AppEnv): boolean {
  return appEnv !== "production";
}
