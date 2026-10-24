import { describe, expect, it } from "vitest";
import { parseEnv } from "@/lib/env";
// @ts-expect-error — módulo .mjs sem tipos (script)
import { buildDemoEnv } from "../../scripts/demo-env.mjs";

/**
 * 006 · T058 (FR-024, FR-026) — o modo demonstração nunca herda credenciais: nem do ambiente nem
 * do `.env.local` (o Next carrega o arquivo mas não sobrescreve variável já definida, então as
 * conhecidas são definidas vazias).
 */
const envLocalCompleto = {
  APP_ENV: "local",
  SUPABASE_URL: "http://127.0.0.1:57321",
  SUPABASE_SECRET_KEY: "sb_secret_x",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_y",
  SUPABASE_DB_URL: "postgresql://x",
  AUTH_ALLOWED_EMAILS: "doug@example.test",
  AUTH_HASH_SECRET: "a".repeat(64),
  APP_ORIGIN: "http://localhost:3000",
  PATH: "/usr/bin",
  NODE_ENV: "production",
};

describe("buildDemoEnv", () => {
  it("define APP_ENV=preview", () => {
    expect(buildDemoEnv(envLocalCompleto).APP_ENV).toBe("preview");
  });

  it("zera toda SUPABASE_*, AUTH_* e APP_ORIGIN vindas do ambiente", () => {
    const env = buildDemoEnv({ ...envLocalCompleto, SUPABASE_OUTRA: "z", AUTH_NOVA: "w" });
    for (const [key, value] of Object.entries(env)) {
      if (/^(SUPABASE_|AUTH_)/.test(key) || key === "APP_ORIGIN") expect(value, key).toBe("");
    }
  });

  it("zera as variáveis que o Next leria do .env.local mesmo se ausentes do ambiente", () => {
    const env = buildDemoEnv({ PATH: "/usr/bin" });
    for (const key of [
      "SUPABASE_URL",
      "SUPABASE_SECRET_KEY",
      "SUPABASE_PUBLISHABLE_KEY",
      "AUTH_ALLOWED_EMAILS",
      "AUTH_HASH_SECRET",
      "APP_ORIGIN",
    ]) {
      expect(env[key], key).toBe("");
    }
  });

  it("preserva o restante do ambiente", () => {
    const env = buildDemoEnv(envLocalCompleto);
    expect(env.PATH).toBe("/usr/bin");
    expect(env.NODE_ENV).toBe("production");
  });

  it("o resultado passa no parseEnv de preview", () => {
    expect(parseEnv(buildDemoEnv(envLocalCompleto))).toEqual({ APP_ENV: "preview" });
  });
});
