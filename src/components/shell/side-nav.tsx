"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { DESTINATIONS } from "@/lib/navigation";
import { cn } from "@/lib/utils";

/**
 * Navegação principal no desktop (≥ md): menu lateral com os mesmos destinos e ordem.
 * 768–1023px: rótulo abaixo do ícone; ≥ 1024px: rótulo ao lado (contracts/navigation.md §1).
 */
export function SideNav() {
  const pathname = usePathname();
  return (
    <div
      data-slot="side-nav"
      className="sticky top-0 hidden h-dvh shrink-0 flex-col gap-6 border-r border-border bg-surface py-4 pl-safe md:flex md:w-24 lg:w-56"
    >
      <Link
        href="/"
        className="mx-auto flex min-h-11 items-center rounded-md px-2 text-primary lg:mx-4"
      >
        <Logo wordClassName="hidden lg:inline" />
      </Link>
      <nav aria-label="Principal">
        <ul className="flex flex-col gap-1 px-2">
          {DESTINATIONS.map(({ id, label, href, icon: Icon, matches }) => {
            const active = matches(pathname);
            return (
              <li key={id}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 flex-col items-center justify-center gap-1 rounded-md px-2 py-2 text-xs font-medium text-foreground-muted transition-colors duration-fast hover:bg-surface-muted lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:text-sm",
                    active && "bg-primary-subtle text-primary hover:bg-primary-subtle",
                  )}
                >
                  <Icon aria-hidden="true" className="size-5" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
