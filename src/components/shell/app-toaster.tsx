"use client";

import { Toaster } from "@/components/ui/sonner";
import { DESKTOP_QUERY, useMediaQuery } from "./use-media-query";

/**
 * Toaster único do app (root layout): no alto no celular (não cobre a barra inferior) e no
 * canto inferior direito no desktop (research R-09). Fica abaixo do selo de demonstração.
 */
export function AppToaster() {
  const desktop = useMediaQuery(DESKTOP_QUERY);
  return (
    <Toaster
      position={desktop ? "bottom-right" : "top-center"}
      style={{ zIndex: "var(--z-toast)" }}
      containerAriaLabel="Avisos"
    />
  );
}
