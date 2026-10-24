"use client";

import type { ReactNode } from "react";
import { useFormState } from "react-hook-form";
import { Button } from "@/components/ui/button";

/**
 * Botão de envio (FR-040, FR-041): principal, fica "enviando" enquanto o formulário envia e
 * ignora toques repetidos. Sem conexão, o `Form` não envia e avisa (runOnline).
 */
export function SubmitButton({
  children,
  variant = "primary",
}: {
  children: ReactNode;
  variant?: "primary" | "destructive";
}) {
  const { isSubmitting } = useFormState();
  return (
    <Button type="submit" variant={variant} pending={isSubmitting}>
      {children}
    </Button>
  );
}
