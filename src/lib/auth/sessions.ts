import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isAllowed, normalizeEmail } from "./allowlist";
import type { CookieJar } from "./cookie-jar";
import { authCookieOptions, deviceCookieOptions } from "./cookie-options";
import { describeDevice } from "./device";
import { recordEvent, type RequestInfo } from "./events";
import type { AuthMethod, AuthStore } from "./store";
import type { ServerAuthEnv } from "./supabase-clients";

/** Cookies da 006 (data-model §10). */
export const DEVICE_COOKIE = "prumo_device";
export const OTP_EMAIL_COOKIE = "prumo_otp_email";
export const NEXT_COOKIE = "prumo_next";
export const ENROLL_COOKIE = "prumo_enroll_until";
export const ENROLL_WINDOW_MS = 10 * 60_000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SessionDeps = {
  env: ServerAuthEnv;
  store: AuthStore;
  jar: CookieJar;
  now: () => Date;
  /** `(await getCoreStore()).bootstrap()` da 004 — idempotente. */
  bootstrap: () => Promise<void>;
};

export type Claims = { sub: string; email: string; sessionId: string };

/** Claims verificados do JWT da sessão atual (getClaims: JWKS ou /user). */
export async function verifiedClaims(auth: SupabaseClient): Promise<Claims | null> {
  const { data, error } = await auth.auth.getClaims();
  const claims = data?.claims as Record<string, unknown> | undefined;
  if (error || !claims) return null;
  const { sub, email, session_id: sessionId } = claims;
  if (typeof sub !== "string" || typeof email !== "string" || typeof sessionId !== "string") {
    return null;
  }
  return { sub, email: normalizeEmail(email), sessionId };
}

/**
 * Depois do Google ou do código (plan §Algoritmo establishSession): confere a allowlist, grava a
 * sessão vinculada ao dispositivo, o evento e abre a janela de cadastro da biometria.
 */
export async function establishSession(
  deps: SessionDeps,
  { auth, method, request }: { auth: SupabaseClient; method: AuthMethod; request: RequestInfo },
): Promise<{ ok: true; claims: Claims } | { ok: false; error: "REFUSED" | "UNAVAILABLE" }> {
  const { env, store, jar } = deps;
  const record = (input: Parameters<typeof recordEvent>[0]) =>
    recordEvent(input, { store, hashSecret: env.AUTH_HASH_SECRET });

  const claims = await verifiedClaims(auth);
  if (!claims) return { ok: false, error: "UNAVAILABLE" };

  if (!isAllowed(claims.email, env.AUTH_ALLOWED_EMAILS)) {
    await auth.auth.signOut({ scope: "local" });
    await record({
      type: "email_refused",
      method,
      email: claims.email,
      emailIsOwner: false,
      request,
    });
    return { ok: false, error: "REFUSED" };
  }

  const now = deps.now();
  const existing = jar.get(DEVICE_COOKIE);
  const deviceId = existing && UUID.test(existing) ? existing : randomUUID();
  jar.set(DEVICE_COOKIE, deviceId, deviceCookieOptions(env.APP_ENV));

  await store.insertSession({
    id: claims.sessionId,
    ownerId: claims.sub,
    deviceId,
    method,
    deviceLabel: describeDevice(request.userAgent),
    now,
  });
  await record({
    type: "login_succeeded",
    method,
    ownerId: claims.sub,
    sessionId: claims.sessionId,
    email: claims.email,
    emailIsOwner: true,
    request,
  });
  try {
    await deps.bootstrap();
  } catch {
    // A 004 também faz bootstrap preguiçoso: não impede a entrada (contracts/dal.md).
  }
  jar.set(
    ENROLL_COOKIE,
    String(now.getTime() + ENROLL_WINDOW_MS),
    authCookieOptions(env.APP_ENV, { maxAge: ENROLL_WINDOW_MS / 1000 }),
  );
  return { ok: true, claims };
}
