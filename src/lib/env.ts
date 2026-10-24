import { z } from "zod";

/**
 * Único ponto do app que lê process.env (Constitution II; regra de lint em eslint.config.mjs).
 * Contrato: specs/001-setup-projeto/data-model.md §3 + specs/006-login/data-model.md §7.
 */

export const APP_ENVS = ["local", "preview", "production"] as const;
export type AppEnv = (typeof APP_ENVS)[number];

export const ENV_NAMES = [
  "APP_ENV",
  "SUPABASE_URL",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_PUBLISHABLE_KEY",
  "AUTH_ALLOWED_EMAILS",
  "AUTH_HASH_SECRET",
  "APP_ORIGIN",
] as const;

/** 006: credenciais que nunca podem existir em preview (FR-027). */
const isCredentialName = (key: string) =>
  key.startsWith("SUPABASE_") || key.startsWith("AUTH_") || key === "APP_ORIGIN";

const allowedEmails = z
  .string()
  .transform((raw) =>
    raw
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  )
  .pipe(z.array(z.email()).min(1));

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/** Origem pura (sem caminho) e nunca IP literal: vira o RP ID do WebAuthn. */
const appOrigin = (protocols: string[]) =>
  z.string().refine((value) => {
    try {
      const url = new URL(value);
      return (
        url.origin === value &&
        protocols.includes(url.protocol) &&
        !IPV4.test(url.hostname) &&
        !url.hostname.startsWith("[")
      );
    } catch {
      return false;
    }
  });

const server = {
  SUPABASE_URL: z.url(),
  SUPABASE_SECRET_KEY: z.string().min(1),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  AUTH_ALLOWED_EMAILS: allowedEmails,
  AUTH_HASH_SECRET: z.string().min(32),
};

const localSchema = z.object({
  APP_ENV: z.literal("local"),
  ...server,
  APP_ORIGIN: appOrigin(["http:", "https:"]),
});

const previewSchema = z.object({ APP_ENV: z.literal("preview") });

const productionSchema = z.object({
  APP_ENV: z.literal("production"),
  ...server,
  APP_ORIGIN: appOrigin(["https:"]),
});

export type Env =
  z.infer<typeof localSchema> | z.infer<typeof previewSchema> | z.infer<typeof productionSchema>;

type Source = Record<string, string | undefined>;

function fail(names: string[]): never {
  const unique = [...new Set(names)].sort();
  throw new Error(
    `Configuração inválida: ${unique.join(", ")}. Veja README#início-rápido e .env.example.`,
  );
}

export function parseEnv(source: Source): Env {
  const appEnv = source.APP_ENV;
  if (!APP_ENVS.includes(appEnv as AppEnv)) fail(["APP_ENV"]);

  // Proteção cruzada: um deploy de preview nunca roda com configuração de outro ambiente.
  if (source.VERCEL_ENV === "preview" && appEnv !== "preview") fail(["APP_ENV"]);

  if (appEnv === "preview") {
    const leaked = Object.keys(source).filter((key) => isCredentialName(key) && source[key]);
    if (leaked.length > 0) fail(leaked);
  }

  const schema =
    appEnv === "local" ? localSchema : appEnv === "preview" ? previewSchema : productionSchema;
  const result = schema.safeParse(source);
  if (!result.success) fail(result.error.issues.map((issue) => String(issue.path[0])));
  return result.data;
}

let cached: Env | undefined;

/** Lê e valida a configuração do processo uma única vez. */
export function loadEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}

/** Versão do app; definida no build por next.config.ts (não é segredo). */
export function appVersion(): string {
  return process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0+dev";
}
