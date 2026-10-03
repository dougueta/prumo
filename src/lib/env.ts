import { z } from "zod";

/**
 * Único ponto do app que lê process.env (Constitution II; regra de lint em eslint.config.mjs).
 * Contrato: specs/001-setup-projeto/data-model.md §3.
 */

export const APP_ENVS = ["local", "preview", "production"] as const;
export type AppEnv = (typeof APP_ENVS)[number];

export const ENV_NAMES = [
  "APP_ENV",
  "SUPABASE_URL",
  "SUPABASE_SECRET_KEY",
  "PRODUCTION_GATE_USER",
  "PRODUCTION_GATE_PASSWORD",
] as const;

const supabase = {
  SUPABASE_URL: z.url(),
  SUPABASE_SECRET_KEY: z.string().min(1),
};

const localSchema = z.object({ APP_ENV: z.literal("local"), ...supabase });

const previewSchema = z.object({ APP_ENV: z.literal("preview") });

const productionSchema = z.object({
  APP_ENV: z.literal("production"),
  ...supabase,
  PRODUCTION_GATE_USER: z.string().min(1),
  PRODUCTION_GATE_PASSWORD: z.string().min(20),
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
    const leaked = Object.keys(source).filter((key) => key.startsWith("SUPABASE_") && source[key]);
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
