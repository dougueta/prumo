import { describe, expect, it } from "vitest";
import { parseEnv } from "@/lib/env";

/** 001 (FR-003/FR-004) + 006 · T005 (FR-022, FR-027, FR-028) — data-model §7 da 006. */
const SECRET = "sb_secret_super_sensitive_value_123";
const HASH_SECRET = "h".repeat(40);
const DOUG = "doug@example.test";

const auth = {
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_abc",
  AUTH_ALLOWED_EMAILS: DOUG,
  AUTH_HASH_SECRET: HASH_SECRET,
};

const local = {
  APP_ENV: "local",
  SUPABASE_URL: "http://127.0.0.1:57321",
  SUPABASE_SECRET_KEY: SECRET,
  ...auth,
  APP_ORIGIN: "http://localhost:3000",
};

const production = {
  APP_ENV: "production",
  SUPABASE_URL: "https://abc.supabase.co",
  SUPABASE_SECRET_KEY: SECRET,
  ...auth,
  APP_ORIGIN: "https://prumo.example.app",
};

function without(source: Record<string, string>, ...names: string[]) {
  const copy: Record<string, string | undefined> = { ...source };
  for (const name of names) delete copy[name];
  return copy;
}

describe("parseEnv", () => {
  it("aceita configuração local válida", () => {
    expect(parseEnv(local)).toMatchObject({ APP_ENV: "local", SUPABASE_URL: local.SUPABASE_URL });
  });

  it("aceita preview sem nenhuma credencial", () => {
    expect(parseEnv({ APP_ENV: "preview", VERCEL_ENV: "preview" })).toEqual({
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
    expect(() => parseEnv(without(local, "SUPABASE_URL", "SUPABASE_SECRET_KEY"))).toThrow(
      /SUPABASE_SECRET_KEY, SUPABASE_URL/,
    );
  });

  it("falha quando VERCEL_ENV=preview e APP_ENV não é preview (proteção cruzada)", () => {
    expect(() => parseEnv({ ...production, VERCEL_ENV: "preview" })).toThrow(/APP_ENV/);
  });

  it("falha com SUPABASE_URL inválida", () => {
    expect(() => parseEnv({ ...local, SUPABASE_URL: "não-é-url" })).toThrow(/SUPABASE_URL/);
  });

  describe("006 · auth", () => {
    for (const [label, base] of [
      ["local", local],
      ["production", production],
    ] as const) {
      for (const name of [
        "SUPABASE_PUBLISHABLE_KEY",
        "AUTH_ALLOWED_EMAILS",
        "AUTH_HASH_SECRET",
        "APP_ORIGIN",
      ]) {
        it(`${label}: exige ${name}`, () => {
          expect(() => parseEnv(without(base, name))).toThrow(new RegExp(name));
        });
      }
    }

    it("normaliza a allowlist (minúsculas, sem espaços, vários e-mails)", () => {
      const env = parseEnv({ ...local, AUTH_ALLOWED_EMAILS: "  Doug@Example.TEST , outro@x.io " });
      expect(env.APP_ENV === "local" && env.AUTH_ALLOWED_EMAILS).toEqual([
        "doug@example.test",
        "outro@x.io",
      ]);
    });

    it("recusa allowlist vazia ou com e-mail inválido", () => {
      expect(() => parseEnv({ ...local, AUTH_ALLOWED_EMAILS: " , " })).toThrow(
        /AUTH_ALLOWED_EMAILS/,
      );
      expect(() => parseEnv({ ...local, AUTH_ALLOWED_EMAILS: `${DOUG},não-é-email` })).toThrow(
        /AUTH_ALLOWED_EMAILS/,
      );
    });

    it("exige AUTH_HASH_SECRET com 32 caracteres ou mais", () => {
      expect(() => parseEnv({ ...local, AUTH_HASH_SECRET: "x".repeat(31) })).toThrow(
        /AUTH_HASH_SECRET/,
      );
      expect(() => parseEnv({ ...local, AUTH_HASH_SECRET: "x".repeat(32) })).not.toThrow();
    });

    it("APP_ORIGIN nunca é IP literal (WebAuthn não aceita IP como RP ID)", () => {
      for (const origin of ["http://127.0.0.1:3000", "http://[::1]:3000", "http://10.0.0.5"]) {
        expect(() => parseEnv({ ...local, APP_ORIGIN: origin }), origin).toThrow(/APP_ORIGIN/);
      }
    });

    it("APP_ORIGIN é só origem (sem caminho) e https em produção", () => {
      expect(() => parseEnv({ ...local, APP_ORIGIN: "http://localhost:3000/x" })).toThrow(
        /APP_ORIGIN/,
      );
      expect(() => parseEnv({ ...production, APP_ORIGIN: "http://prumo.example.app" })).toThrow(
        /APP_ORIGIN/,
      );
    });

    it("não exige mais a trava provisória da 001 (FR-028)", () => {
      const env = parseEnv(production) as Record<string, unknown>;
      expect(env).not.toHaveProperty("PRODUCTION_GATE_USER");
      expect(env).not.toHaveProperty("PRODUCTION_GATE_PASSWORD");
    });

    for (const name of [
      "SUPABASE_URL",
      "SUPABASE_PUBLISHABLE_KEY",
      "AUTH_ALLOWED_EMAILS",
      "AUTH_HASH_SECRET",
      "APP_ORIGIN",
    ]) {
      it(`preview falha se houver ${name} (FR-027)`, () => {
        expect(() => parseEnv({ APP_ENV: "preview", [name]: "qualquer" })).toThrow(
          new RegExp(name),
        );
      });
    }

    it("preview aceita as variáveis definidas vazias (start-demo)", () => {
      expect(parseEnv({ APP_ENV: "preview", AUTH_HASH_SECRET: "", APP_ORIGIN: "" })).toEqual({
        APP_ENV: "preview",
      });
    });
  });

  it("nunca expõe valores na mensagem de erro (só nomes)", () => {
    try {
      parseEnv({
        ...production,
        AUTH_HASH_SECRET: "curto",
        AUTH_ALLOWED_EMAILS: "segredo@pessoal.com,inválido",
        SUPABASE_URL: "x",
      });
      expect.unreachable();
    } catch (error) {
      const message = (error as Error).message;
      expect(message).not.toContain(SECRET);
      expect(message).not.toContain("curto");
      expect(message).not.toContain("segredo@pessoal.com");
      expect(message).toMatch(/README/);
    }
  });
});
