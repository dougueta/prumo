import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import betterTailwindcss from "eslint-plugin-better-tailwindcss";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Constitution II: configuração só é lida por src/lib/env.ts (validada por zod).
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/env.ts"],
    rules: {
      "no-restricted-properties": [
        "error",
        { object: "process", property: "env", message: "Use loadEnv() de src/lib/env.ts." },
      ],
    },
  },
  {
    // FR-004: só classes que existem no tema (tokens da 003; a paleta padrão foi removida).
    files: ["src/app/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}", "src/catalog/**/*.{ts,tsx}"],
    plugins: { "better-tailwindcss": betterTailwindcss },
    settings: { "better-tailwindcss": { entryPoint: "src/app/globals.css" } },
    rules: {
      "better-tailwindcss/no-unknown-classes": "error",
    },
  },
  {
    // FR-004: telas e componentes do design system não usam dark: (tema vem dos tokens) nem
    // valores arbitrários. Exceção: src/components/ui/ (código gerado pelo shadcn).
    files: [
      "src/app/**/*.{ts,tsx}",
      "src/catalog/**/*.{ts,tsx}",
      "src/components/{finance,states,forms,shell,brand}/**/*.{ts,tsx}",
    ],
    plugins: { "better-tailwindcss": betterTailwindcss },
    settings: { "better-tailwindcss": { entryPoint: "src/app/globals.css" } },
    rules: {
      "better-tailwindcss/no-restricted-classes": [
        "error",
        {
          restrict: [
            {
              pattern: "^dark:",
              message: "Não use dark: — o tema vem dos tokens (src/styles/tokens.css).",
            },
            {
              pattern: "\\[.*\\]",
              message: "Valor arbitrário fora dos fundamentos: use um token do design system.",
            },
          ],
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    ".specify/**",
    ".claude/**",
  ]),
]);

export default eslintConfig;
