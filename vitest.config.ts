import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

process.env.TZ = "America/Sao_Paulo";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
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
          name: "integration",
          include: ["tests/integration/**/*.int.test.ts"],
          environment: "node",
          setupFiles: ["tests/setup.ts"],
          testTimeout: 30_000,
        },
      },
    ],
  },
});
