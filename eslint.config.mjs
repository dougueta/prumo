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
