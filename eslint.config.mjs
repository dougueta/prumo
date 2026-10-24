import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

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
    // 004 · Constitution VII: outras features usam só a porta pública `@/data/core`.
    files: ["**/*.{ts,tsx,mts}"],
    ignores: [
      "src/data/core/**",
      "tests/unit/**",
      "tests/integration/**",
      "tests/contract/**",
      "tests/helpers/**",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/data/core/supabase/*", "@/data/core/memory/*"],
              message: "Use a porta pública `@/data/core` (getCoreStore/createCoreStore).",
            },
          ],
        },
      ],
    },
  },
  {
    // 004 · Constitution IV: nada é apagado fisicamente nas tabelas core (use softDelete).
    files: ["**/*.{ts,tsx,mts,js,mjs}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.property.name='delete'][callee.object.callee.property.name='from'][callee.object.arguments.0.value=/^(institutions|accounts|transactions|categories|category_templates|import_batches|audit_log)$/]",
          message: "DELETE físico em tabela core é proibido (FR-037): use softDelete/arquivamento.",
        },
      ],
    },
  },
  globalIgnores([
    "tests/fixtures/lint/**",
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
