import { ArrowLeft, MoreHorizontal, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PrivacyToggle } from "./privacy-toggle";

export type PageHeaderAction = {
  label: string;
  icon: LucideIcon;
  /** Exatamente um dos dois. `onClick` só existe em páginas cliente. */
  onClick?: () => void;
  href?: string;
};

const MAX_VISIBLE_ACTIONS = 2;

/**
 * Cabeçalho de toda tela do shell (FR-010): título em h1, voltar opcional, até 2 ações
 * visíveis (as demais no menu "Mais ações") e sempre o botão de ocultar valores.
 * Respeita a área segura superior (FR-015).
 */
export function PageHeader({
  title,
  back,
  actions = [],
}: {
  title: string;
  back?: string;
  actions?: PageHeaderAction[];
}) {
  const visible = actions.slice(0, MAX_VISIBLE_ACTIONS);
  const overflow = actions.slice(MAX_VISIBLE_ACTIONS);
  return (
    <header className="pt-safe">
      <div className="flex min-h-14 items-center gap-2 py-3">
        {back ? (
          <Button variant="ghost" size="icon" aria-label="Voltar" asChild>
            <Link href={back} aria-label="Voltar">
              <ArrowLeft aria-hidden="true" />
            </Link>
          </Button>
        ) : (
          <Logo variant="symbol" className="text-primary md:hidden" />
        )}
        <h1 className="min-w-0 flex-1 truncate text-xl font-semibold md:text-2xl">{title}</h1>
        <div className="flex items-center gap-1">
          {visible.map(({ label, icon: Icon, onClick, href }) =>
            href ? (
              <Button key={label} variant="ghost" size="icon" aria-label={label} asChild>
                <Link href={href} aria-label={label}>
                  <Icon aria-hidden="true" />
                </Link>
              </Button>
            ) : (
              <Button key={label} variant="ghost" size="icon" aria-label={label} onClick={onClick}>
                <Icon aria-hidden="true" />
              </Button>
            ),
          )}
          {overflow.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Mais ações">
                  <MoreHorizontal aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {overflow.map(({ label, icon: Icon, onClick, href }) =>
                  href ? (
                    <DropdownMenuItem key={label} asChild>
                      <Link href={href}>
                        <Icon aria-hidden="true" />
                        {label}
                      </Link>
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem key={label} onSelect={onClick}>
                      <Icon aria-hidden="true" />
                      {label}
                    </DropdownMenuItem>
                  ),
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <PrivacyToggle />
        </div>
      </div>
    </header>
  );
}
