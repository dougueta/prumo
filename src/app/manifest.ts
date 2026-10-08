import type { MetadataRoute } from "next";
import { BRAND_COLOR, SPLASH_BACKGROUND } from "@/styles/tokens";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Prumo",
    short_name: "Prumo",
    description: "Suas finanças no prumo.",
    lang: "pt-BR",
    start_url: "/",
    scope: "/",
    display: "standalone",
    // Tela de abertura: ícone claro sobre a cor da marca (FR-006, data-model §1.1b).
    background_color: SPLASH_BACKGROUND,
    theme_color: BRAND_COLOR,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
