"use client";

import { type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useBackToClose, useOpener } from "@/components/shell/use-back-to-close";
import { DESKTOP_QUERY, useMediaQuery } from "@/components/shell/use-media-query";

/**
 * Diálogo responsivo (FR-044): painel inferior em telas estreitas e diálogo central a partir de
 * `md`. Prende o foco, fecha com Esc, toque fora e gesto de voltar e devolve o foco ao gatilho
 * (FR-024). Título obrigatório (nome acessível).
 */
export function ResponsiveDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const desktop = useMediaQuery(DESKTOP_QUERY);
  // Sem descrição, o Radix pede aria-describedby explícito como undefined.
  const noDescription = description ? {} : { "aria-describedby": undefined };
  useBackToClose(open, () => onOpenChange(false));

  // Diálogo controlado (sem Trigger do Radix): devolve o foco a quem o abriu.
  const opener = useOpener(open);
  const restoreFocus = (event: Event) => {
    event.preventDefault();
    opener?.focus();
  };

  if (desktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent {...noDescription} onCloseAutoFocus={restoreFocus}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          {children}
        </DialogContent>
      </Dialog>
    );
  }
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        {...noDescription}
        onCloseAutoFocus={restoreFocus}
        side="bottom"
        className="max-h-dvh overflow-y-auto rounded-t-xl pb-safe"
      >
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <div className="px-4 pb-4">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
