import { connection } from "next/server";
import { isDemo } from "@/lib/app-env";

/** Selo exibido em toda tela no modo demonstração (FR-011, ADR 0006). Lido em runtime. */
export async function DemoBadge() {
  await connection();
  if (!isDemo()) return null;
  return (
    <div
      role="status"
      className="sticky top-0 z-demo w-full bg-demo px-4 py-1 text-center text-sm font-medium text-demo-foreground"
    >
      Demonstração — dados fictícios
    </div>
  );
}
