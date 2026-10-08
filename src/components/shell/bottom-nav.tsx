"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DESTINATIONS } from "@/lib/navigation";
import { cn } from "@/lib/utils";

/** Navegação principal no celular (< md): barra inferior fixa, ícone + rótulo (FR-007). */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Principal"
      data-slot="bottom-nav"
      className="fixed inset-x-0 bottom-0 z-nav border-t border-border bg-surface pb-safe shadow-md md:hidden"
    >
      <ul className="mx-auto flex max-w-content">
        {DESTINATIONS.map(({ id, label, href, icon: Icon, matches }) => {
          const active = matches(pathname);
          return (
            <li key={id} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 flex-col items-center justify-center gap-0.5 px-1 py-2 text-xs font-medium text-foreground-muted transition-colors duration-fast",
                  active && "bg-primary-subtle text-primary",
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
  );
}
