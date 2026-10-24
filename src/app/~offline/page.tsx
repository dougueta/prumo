import { WifiOff } from "lucide-react";
import { Logo } from "@/components/brand/logo";

export const metadata = { title: "Sem conexão · Prumo" };

/** Página "sem conexão" (001), fora do shell, com a identidade da 003 (FR-006). */
export default function Offline() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <Logo className="text-primary" />
      <WifiOff aria-hidden="true" className="size-8 text-foreground-muted" />
      <h1 className="text-2xl font-semibold">Você está sem conexão</h1>
      <p className="max-w-sm text-foreground-muted">
        O Prumo precisa de internet para mostrar seus dados. Assim que a conexão voltar, é só tentar
        de novo.
      </p>
    </main>
  );
}
