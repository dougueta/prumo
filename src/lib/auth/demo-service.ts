import "server-only";
import { z } from "zod";
import { normalizeEmail } from "./allowlist";
import type { CookieJar } from "./cookie-jar";
import { authCookieOptions } from "./cookie-options";
import { DEMO_EMAIL } from "./dal-core";
import { safeNext } from "./safe-next";
import type { AuthService } from "./service";
import { OTP_EMAIL_COOKIE } from "./sessions";

/**
 * AuthService do modo demonstração (APP_ENV=preview; data-model §9): simula os fluxos sem
 * provedor nem banco. Estado só em memória, por `prumo_demo_sid` (sessão demo da 004, ≤ 2 h).
 * Só é alcançável por `getAuthService()` com APP_ENV=preview (FR-026).
 */
export const DEMO_CODE = "246810";
export const DEMO_EXPIRED_CODE = "111111";
export const DEMO_OUT_COOKIE = "prumo_demo_out";
const DEMO_SESSION_COOKIE = "prumo_demo_sid";
const MAX_FAILURES = 5;
const TTL_MS = 2 * 60 * 60_000;
const MAX_SESSIONS = 500;

type DemoState = { failures: number; touchedAt: number };
const states = new Map<string, DemoState>();

function stateFor(sid: string): DemoState {
  const now = Date.now();
  for (const [key, value] of states) if (now - value.touchedAt > TTL_MS) states.delete(key);
  if (states.size >= MAX_SESSIONS && !states.has(sid)) {
    const oldest = [...states].sort((a, b) => a[1].touchedAt - b[1].touchedAt)[0];
    if (oldest) states.delete(oldest[0]);
  }
  const state = states.get(sid) ?? { failures: 0, touchedAt: now };
  state.touchedAt = now;
  states.set(sid, state);
  return state;
}

export function createDemoAuthService(jar: CookieJar): AuthService {
  // Sem prumo_demo_sid (primeiro pedido): estado só deste pedido.
  const sid = jar.get(DEMO_SESSION_COOKIE) ?? `efemera-${Math.random()}`;
  const short = authCookieOptions("preview", { maxAge: 600 });

  return {
    kind: "demo",

    async requestCode({ email: raw }) {
      const parsed = z.email().safeParse(normalizeEmail(raw));
      if (!parsed.success) return { ok: false, error: "INVALID_EMAIL" };
      jar.set(OTP_EMAIL_COOKIE, parsed.data, short);
      return { ok: true };
    },

    async verifyCode({ code, next }) {
      const state = stateFor(sid);
      if (state.failures >= MAX_FAILURES) return { ok: false, error: "TOO_MANY" };
      const email = jar.get(OTP_EMAIL_COOKIE);
      if (email === DEMO_EMAIL && code === DEMO_CODE) {
        state.failures = 0;
        jar.set(DEMO_OUT_COOKIE, "", authCookieOptions("preview", { maxAge: 0 }));
        jar.set(OTP_EMAIL_COOKIE, "", authCookieOptions("preview", { maxAge: 0 }));
        return { ok: true, next: safeNext(next) };
      }
      state.failures += 1;
      if (email === DEMO_EMAIL && code === DEMO_EXPIRED_CODE) {
        return { ok: false, error: "EXPIRED_OR_USED" };
      }
      return { ok: false, error: "WRONG_CODE" };
    },

    async startGoogle() {
      return { ok: false, error: "UNAVAILABLE" };
    },

    async completeGoogle() {
      return { ok: false, error: "UNAVAILABLE" };
    },
  };
}

export function getDemoAuthService(jar: CookieJar): AuthService {
  return createDemoAuthService(jar);
}
