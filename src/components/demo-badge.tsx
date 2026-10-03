import { connection } from "next/server";
import { isDemo } from "@/lib/app-env";

/** Selo exibido em toda tela no modo demonstração (FR-011, ADR 0006). Lido em runtime. */
export async function DemoBadge() {
  await connection();
  if (!isDemo()) return null;
  return (
    <div
      role="status"
      className="sticky top-0 z-50 w-full bg-amber-100 px-4 py-1 text-center text-sm font-medium text-amber-900 dark:bg-amber-900 dark:text-amber-50"
    >
      Demonstração — dados fictícios
    </div>
  );
}
