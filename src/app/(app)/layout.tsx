import { AppShell } from "@/components/shell/app-shell";

/**
 * Grupo de rotas com o shell do app (contracts/navigation.md §4, §6). A 006 acrescenta a
 * guarda de sessão nas páginas/actions, sem recriar este layout.
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return <AppShell>{children}</AppShell>;
}
