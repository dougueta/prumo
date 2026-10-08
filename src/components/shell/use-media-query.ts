"use client";

import { useSyncExternalStore } from "react";

/** Breakpoint do shell (data-model §2): `md` = 48rem. */
export const DESKTOP_QUERY = "(min-width: 48rem)";

/** `true` quando a media query casa. No servidor (e na hidratação) assume celular. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
