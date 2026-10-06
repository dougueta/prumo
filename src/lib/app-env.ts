import { loadEnv, type AppEnv } from "@/lib/env";

export function getAppEnv(): AppEnv {
  return loadEnv().APP_ENV;
}

/** Pré-visualizações rodam em modo demonstração: sem banco, só dados sintéticos (ADR 0006). */
export function isDemo(): boolean {
  return getAppEnv() === "preview";
}
