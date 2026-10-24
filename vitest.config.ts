import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

process.env.TZ = "America/Sao_Paulo";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // server-only lança erro fora do bundler do Next; nos testes (Node) é inofensivo.
      "server-only": path.resolve(__dirname, "tests/server-only-stub.ts"),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.{ts,tsx}"],
          environment: "node",
          setupFiles: ["tests/setup.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "component",
          include: ["tests/component/**/*.test.tsx"],
          environment: "jsdom",
          setupFiles: ["tests/setup.ts", "tests/setup-dom.ts"],
        },
      },
      {
        extends: true,
        test: {
          // 006: contratos com o Supabase Auth simulado por MSW — nenhuma requisição sai da máquina.
          name: "contract",
          include: ["tests/contract/**/*.test.ts"],
          environment: "node",
          // Sem tests/setup.ts: aquela trava libera localhost; aqui o MSW recusa qualquer host.
          setupFiles: ["tests/contract/setup.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.int.test.ts"],
          // 004: um arquivo por vez — TRUNCATE (teste de proibição) e a carga de 100 mil linhas do
          // teste de desempenho disputam bloqueios com os demais testes no mesmo banco.
          fileParallelism: false,
          environment: "node",
          setupFiles: ["tests/setup.ts"],
          testTimeout: 30_000,
        },
      },
    ],
  },
});
