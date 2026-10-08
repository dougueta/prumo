import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { cookies } from "next/headers";
import { DemoBadge } from "@/components/shell/demo-badge";
import { EnvIndicator } from "@/components/shell/env-indicator";
import { PreferencesProvider } from "@/components/shell/preferences-provider";
import { TodayProvider } from "@/components/shell/today-provider";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { todayInSaoPaulo } from "@/lib/format";
import { PRIVACY_COOKIE, THEME_COOKIE, parsePrivacy, parseTheme } from "@/lib/preferences";
import { THEME_COLOR } from "@/styles/tokens";
import "./globals.css";

// Inter Variable auto-hospedada (R-04): nenhuma requisição externa, nem no build.
const inter = localFont({
  src: [
    { path: "./fonts/InterVariable-latin.woff2", weight: "100 900", style: "normal" },
    { path: "./fonts/InterVariable-latin-italic.woff2", weight: "100 900", style: "italic" },
  ],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Prumo",
  description: "Suas finanças no prumo.",
  applicationName: "Prumo",
  appleWebApp: { capable: true, title: "Prumo", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

/** FR-015 (área segura) e FR-018 (cor da barra do sistema segue o tema escolhido). */
export async function generateViewport(): Promise<Viewport> {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE));
  return {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
    themeColor:
      theme === "auto"
        ? [
            { media: "(prefers-color-scheme: light)", color: THEME_COLOR.light },
            { media: "(prefers-color-scheme: dark)", color: THEME_COLOR.dark },
          ]
        : THEME_COLOR[theme],
  };
}

// Tema e privacidade lidos no servidor: o HTML já sai certo, sem "piscar" (R-02, R-06).
export default async function RootLayout({ children }: LayoutProps<"/">) {
  const jar = await cookies();
  const theme = parseTheme(jar.get(THEME_COOKIE));
  const privacy = parsePrivacy(jar.get(PRIVACY_COOKIE));
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} h-full`}
      data-theme={theme === "auto" ? undefined : theme}
      data-privacy={privacy === "on" ? "on" : undefined}
    >
      <body className="flex min-h-full flex-col">
        <DemoBadge />
        <EnvIndicator />
        <PreferencesProvider initialTheme={theme} initialPrivacy={privacy}>
          <TodayProvider today={todayInSaoPaulo()}>{children}</TodayProvider>
        </PreferencesProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
