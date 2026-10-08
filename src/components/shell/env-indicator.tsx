import { connection } from "next/server";
import { getAppEnv } from "@/lib/app-env";

/** Indicador discreto do ambiente: só em `local` (FR-013). Não intercepta toques. */
export async function EnvIndicator() {
  await connection();
  if (getAppEnv() !== "local") return null;
  return (
    <div
      aria-label="Ambiente: Local"
      className="pointer-events-none fixed right-2 bottom-20 z-demo rounded-full border border-info bg-info-subtle px-2 py-0.5 text-xs font-medium text-info md:bottom-2"
    >
      Local
    </div>
  );
}
