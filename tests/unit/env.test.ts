import { describe, expect, it } from "vitest";
import { parseEnv } from "@/lib/env";

const SECRET = "sb_secret_super_sensitive_value_123";
const GATE_PASSWORD = "uma-senha-bem-longa-com-20+";

const local = {
  APP_ENV: "local",
  SUPABASE_URL: "http://127.0.0.1:57321",
  SUPABASE_SECRET_KEY: SECRET,
};

const production = {
  APP_ENV: "production",
  SUPABASE_URL: "https://abc.supabase.co",
  SUPABASE_SECRET_KEY: SECRET,
  PRODUCTION_GATE_USER: "doug",
  PRODUCTION_GATE_PASSWORD: GATE_PASSWORD,
};

describe("parseEnv", () => {
  it("aceita configuração local válida", () => {
    expect(parseEnv(local)).toMatchObject({ APP_ENV: "local", SUPABASE_URL: local.SUPABASE_URL });
  });

  it("aceita preview sem nenhuma variável SUPABASE_*", () => {
    expect(parseEnv({ APP_ENV: "preview", VERCEL_ENV: "preview" })).toMatchObject({
      APP_ENV: "preview",
    });
  });

  it("aceita produção completa", () => {
    expect(parseEnv(production).APP_ENV).toBe("production");
  });

  it("falha sem APP_ENV, citando o nome", () => {
    expect(() => parseEnv({})).toThrow(/APP_ENV/);
  });

  it("falha com APP_ENV desconhecido", () => {
    expect(() => parseEnv({ APP_ENV: "staging" })).toThrow(/APP_ENV/);
  });

  it("falha em local sem Supabase, listando os nomes faltantes", () => {
    expect(() => parseEnv({ APP_ENV: "local" })).toThrow(/SUPABASE_SECRET_KEY, SUPABASE_URL/);
  });

  it("falha em preview se houver qualquer SUPABASE_*", () => {
    expect(() => parseEnv({ APP_ENV: "preview", SUPABASE_URL: "https://x.supabase.co" })).toThrow(
      /SUPABASE_URL/,
    );
  });

  it("falha quando VERCEL_ENV=preview e APP_ENV não é preview (proteção cruzada)", () => {
    expect(() => parseEnv({ ...production, VERCEL_ENV: "preview" })).toThrow(/APP_ENV/);
  });

  it("falha em produção sem a trava provisória", () => {
    const withoutPassword: Record<string, string | undefined> = { ...production };
    delete withoutPassword.PRODUCTION_GATE_PASSWORD;
    expect(() => parseEnv(withoutPassword)).toThrow(/PRODUCTION_GATE_PASSWORD/);
  });

  it("falha em produção com senha da trava curta", () => {
    expect(() => parseEnv({ ...production, PRODUCTION_GATE_PASSWORD: "curta" })).toThrow(
      /PRODUCTION_GATE_PASSWORD/,
    );
  });

  it("falha com SUPABASE_URL inválida", () => {
    expect(() => parseEnv({ ...local, SUPABASE_URL: "não-é-url" })).toThrow(/SUPABASE_URL/);
  });

  it("nunca expõe valores na mensagem de erro", () => {
    try {
      parseEnv({ ...production, PRODUCTION_GATE_PASSWORD: "curta", SUPABASE_URL: "x" });
      expect.unreachable();
    } catch (error) {
      const message = (error as Error).message;
      expect(message).not.toContain(SECRET);
      expect(message).not.toContain("curta");
      expect(message).toMatch(/README/);
    }
  });
});
