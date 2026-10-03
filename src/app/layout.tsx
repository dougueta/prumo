import type { Metadata, Viewport } from "next";
import { DemoBadge } from "@/components/demo-badge";
import { ServiceWorkerRegister } from "@/components/sw-register";
import "./globals.css";

export const metadata: Metadata = {
  title: "Prumo",
  description: "Suas finanças no prumo.",
  applicationName: "Prumo",
  appleWebApp: { capable: true, title: "Prumo", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1214" },
  ],
};

// Tipografia, cores e shell definitivos vêm da feature 003 (design system).
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <DemoBadge />
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
