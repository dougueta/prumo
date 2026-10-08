"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import {
  PRIVACY_COOKIE,
  THEME_COOKIE,
  setPreference,
  type PrivacyPreference,
  type ThemePreference,
} from "@/lib/preferences";
import { THEME_COLOR } from "@/styles/tokens";

/**
 * Preferências de exibição no cliente (FR-017, FR-018, FR-031). O valor inicial vem dos cookies
 * lidos no root layout; mudar = trocar o atributo do <html> (instantâneo, sem re-render das
 * telas) + gravar o cookie. Cookie bloqueado: a mudança vale na sessão, sem erro.
 */
type Preferences = {
  theme: ThemePreference;
  privacy: PrivacyPreference;
  setTheme: (theme: ThemePreference) => void;
  setPrivacy: (privacy: PrivacyPreference) => void;
};

const PreferencesContext = createContext<Preferences | null>(null);

function applyTheme(theme: ThemePreference) {
  const root = document.documentElement;
  if (theme === "auto") delete root.dataset.theme;
  else root.dataset.theme = theme;
  // <meta name="theme-color">: tema fixo → todas as metas na cor do tema; automático → por mídia.
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    const media = meta.getAttribute("media") ?? "";
    const byMedia = media.includes("dark") ? THEME_COLOR.dark : THEME_COLOR.light;
    meta.setAttribute("content", theme === "auto" ? byMedia : THEME_COLOR[theme]);
  }
  setPreference(THEME_COOKIE, theme);
}

function applyPrivacy(privacy: PrivacyPreference) {
  const root = document.documentElement;
  if (privacy === "on") root.dataset.privacy = "on";
  else delete root.dataset.privacy;
  setPreference(PRIVACY_COOKIE, privacy);
}

function useLocalPreferences(initialTheme: ThemePreference, initialPrivacy: PrivacyPreference) {
  const [theme, setThemeState] = useState(initialTheme);
  const [privacy, setPrivacyState] = useState(initialPrivacy);
  const setTheme = useCallback((next: ThemePreference) => {
    applyTheme(next);
    setThemeState(next);
  }, []);
  const setPrivacy = useCallback((next: PrivacyPreference) => {
    applyPrivacy(next);
    setPrivacyState(next);
  }, []);
  return useMemo(
    () => ({ theme, privacy, setTheme, setPrivacy }),
    [theme, privacy, setTheme, setPrivacy],
  );
}

export function PreferencesProvider({
  initialTheme,
  initialPrivacy,
  children,
}: {
  initialTheme: ThemePreference;
  initialPrivacy: PrivacyPreference;
  children: ReactNode;
}) {
  const value = useLocalPreferences(initialTheme, initialPrivacy);
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

function fromDocument(): { theme: ThemePreference; privacy: PrivacyPreference } {
  if (typeof document === "undefined") return { theme: "auto", privacy: "off" };
  const { theme, privacy } = document.documentElement.dataset;
  return {
    theme: theme === "light" || theme === "dark" ? theme : "auto",
    privacy: privacy === "on" ? "on" : "off",
  };
}

/** Preferências atuais; sem provider (testes isolados), lê o estado do <html>. */
export function usePreferences(): Preferences {
  const context = useContext(PreferencesContext);
  const initial = fromDocument();
  const local = useLocalPreferences(initial.theme, initial.privacy);
  return context ?? local;
}
