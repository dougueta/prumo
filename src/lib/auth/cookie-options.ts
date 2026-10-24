import type { AppEnv } from "@/lib/env";

/**
 * Única fonte das opções de cookie de auth (FR-023; data-model §10). Usada por TODOS os
 * adaptadores: `cookies()` do Next (Server Actions/Route Handlers) e o proxy.
 */
export const AUTH_COOKIE_MAX_AGE_S = 90 * 24 * 60 * 60;
/** Só `prumo_device`: máximo aceito pelos navegadores. */
export const DEVICE_COOKIE_MAX_AGE_S = 400 * 24 * 60 * 60;

export type AuthCookieOptions = {
  httpOnly: true;
  sameSite: "lax";
  path: "/";
  secure: boolean;
  maxAge: number;
};

export function authCookieOptions(
  appEnv: AppEnv,
  { maxAge = AUTH_COOKIE_MAX_AGE_S }: { maxAge?: number } = {},
): AuthCookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: appEnv !== "local",
    maxAge: Math.min(Math.max(maxAge, 0), AUTH_COOKIE_MAX_AGE_S),
  };
}

export function deviceCookieOptions(appEnv: AppEnv): AuthCookieOptions {
  return { ...authCookieOptions(appEnv), maxAge: DEVICE_COOKIE_MAX_AGE_S };
}
