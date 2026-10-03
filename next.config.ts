import path from "node:path";
import type { NextConfig } from "next";
import pkg from "./package.json" with { type: "json" };

const commit = (process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? "local").slice(0, 7);

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_APP_VERSION: `${pkg.version}+${commit}` },
  poweredByHeader: false,
  // Fixa a raiz do projeto (há um package-lock.json solto no diretório do usuário).
  turbopack: { root: path.resolve(".") },
  // Guia PWA do Next 16: o service worker nunca deve ficar em cache.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
