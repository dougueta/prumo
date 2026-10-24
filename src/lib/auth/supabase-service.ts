import "server-only";
import type { AuthError } from "@supabase/supabase-js";
import { z } from "zod";
import { isAllowed, normalizeEmail } from "./allowlist";
import type { CookieJar } from "./cookie-jar";
import { authCookieOptions } from "./cookie-options";
import { hmacHex } from "./crypto";
import { recordEvent, type RequestInfo } from "./events";
import { withFloor } from "./neutral-timing";
import { classifyOtpFailure } from "./otp-classify";
import { evaluateRateLimit } from "./rate-limit";
import { safeNext } from "./safe-next";
import type { AuthService, VerifyCodeError } from "./service";
import { establishSession, NEXT_COOKIE, OTP_EMAIL_COOKIE, type SessionDeps } from "./sessions";
import type { AuthStore } from "./store";
import {
  createAuthClientFor,
  createStatelessAuthClientFor,
  type ServerAuthEnv,
} from "./supabase-clients";

export type { ServerAuthEnv };

/**
 * AuthService real (contracts/auth-flows.md §4): Supabase Auth para identidade, AuthStore para
 * sessões/eventos/limites. Uma instância por pedido (o cliente Auth vive nos cookies do jar).
 */

const REQUEST_FLOOR_MS = 1500;
const VERIFY_FAILURE_FLOOR_MS = 1000;
const SHORT_COOKIE_S = 600;

export type Clock = {
  now: () => Date;
  /** Relógio monotônico (ms) para os pisos de tempo. */
  elapsed: () => number;
  sleep: (ms: number) => Promise<void>;
};

export type ServiceDeps = {
  env: ServerAuthEnv;
  store: AuthStore;
  jar: CookieJar;
  clock: Clock;
  bootstrap: SessionDeps["bootstrap"];
};

/** Provedor fora (rede ou 5xx) ≠ código recusado (4xx). */
function isUnavailable(error: AuthError): boolean {
  return error.name === "AuthRetryableFetchError" || !error.status || error.status >= 500;
}

const isSignupDisabled = (text: string | null | undefined) =>
  !!text && /signup_disabled|signups? not allowed/i.test(text);

export function createSupabaseAuthService(deps: ServiceDeps): AuthService {
  const { env, store, jar, clock } = deps;
  const auth = createAuthClientFor(env, jar);
  const hash = (value: string) => hmacHex(env.AUTH_HASH_SECRET, value);
  const record = (input: Parameters<typeof recordEvent>[0]) =>
    recordEvent(input, { store, hashSecret: env.AUTH_HASH_SECRET });
  const otpClient = createStatelessAuthClientFor(env);
  const floorClock = { now: clock.elapsed, sleep: clock.sleep };
  const sessionDeps = { env, store, jar, now: clock.now, bootstrap: deps.bootstrap };

  async function limits(kind: "request" | "verify", email: string, request: RequestInfo) {
    const counts = await store.rateLimitCounts({
      emailHash: hash(email),
      ipHash: hash(request.ip ?? "local"),
      now: clock.now(),
    });
    return evaluateRateLimit(kind, counts);
  }

  return {
    kind: "supabase",

    requestCode({ email: raw, request }) {
      return withFloor(
        REQUEST_FLOOR_MS,
        async () => {
          const parsed = z.email().safeParse(normalizeEmail(raw));
          if (!parsed.success) return { ok: false, error: "INVALID_EMAIL" } as const;
          const email = parsed.data;
          const allowed = isAllowed(email, env.AUTH_ALLOWED_EMAILS);

          const decision = await limits("request", email, request);
          if (decision.decision === "BLOCKED") {
            await record({
              type: "login_blocked",
              reason: decision.reason,
              email,
              emailIsOwner: allowed,
              request,
            });
            return { ok: false, error: "TOO_MANY" } as const;
          }

          if (allowed) {
            // Cliente sem cookies: o fluxo PKCE do cliente da sessão gravaria um code-verifier
            // só para e-mail autorizado — os Set-Cookie revelariam quem tem acesso (FR-002).
            const { error } = await otpClient.auth.signInWithOtp({
              email,
              options: { shouldCreateUser: false },
            });
            if (error) await record({ type: "provider_error", reason: "email_send", request });
          } else {
            // Nunca chama o provedor para e-mail fora da lista (FR-002). Não conta como falha.
            await record({ type: "email_refused", email, emailIsOwner: false, request });
          }
          await record({ type: "otp_requested", email, emailIsOwner: allowed, request });
          jar.set(
            OTP_EMAIL_COOKIE,
            email,
            authCookieOptions(env.APP_ENV, { maxAge: SHORT_COOKIE_S }),
          );
          return { ok: true } as const;
        },
        floorClock,
      );
    },

    async verifyCode({ code, next, request }) {
      const start = clock.elapsed();
      const fail = async (error: VerifyCodeError) => {
        const remaining = VERIFY_FAILURE_FLOOR_MS - (clock.elapsed() - start);
        if (remaining > 0) await clock.sleep(remaining);
        return { ok: false, error } as const;
      };

      const email = jar.get(OTP_EMAIL_COOKIE);
      if (!email) return fail("EXPIRED_OR_USED");
      const allowed = isAllowed(email, env.AUTH_ALLOWED_EMAILS);
      const failed = (reason: "wrong_code" | "expired" | "used") =>
        record({ type: "otp_failed", reason, email, emailIsOwner: allowed, request });

      if (!/^\d{6}$/.test(code)) {
        await failed("wrong_code");
        return fail("WRONG_CODE");
      }
      const decision = await limits("verify", email, request);
      if (decision.decision === "BLOCKED") {
        await record({
          type: "login_blocked",
          reason: decision.reason,
          email,
          emailIsOwner: allowed,
          request,
        });
        return fail("TOO_MANY");
      }
      if (!allowed) {
        await failed("wrong_code"); // igual ao autorizado: conta como falha, sem provedor
        return fail("WRONG_CODE");
      }

      const { error } = await auth.auth.verifyOtp({ email, token: code, type: "email" });
      if (error) {
        if (isUnavailable(error)) {
          await record({ type: "provider_error", reason: "auth_unavailable", request });
          return fail("UNAVAILABLE");
        }
        const reason = classifyOtpFailure(await store.otpHistory(hash(email)), clock.now());
        await failed(reason);
        return fail(reason === "wrong_code" ? "WRONG_CODE" : "EXPIRED_OR_USED");
      }

      const established = await establishSession(sessionDeps, {
        auth,
        method: "email_otp",
        request,
      });
      if (!established.ok) return fail("UNAVAILABLE");
      jar.set(OTP_EMAIL_COOKIE, "", authCookieOptions(env.APP_ENV, { maxAge: 0 }));
      return { ok: true, next: safeNext(next) };
    },

    async startGoogle({ next, request }) {
      jar.set(
        NEXT_COOKIE,
        safeNext(next),
        authCookieOptions(env.APP_ENV, { maxAge: SHORT_COOKIE_S }),
      );
      const { data, error } = await auth.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${env.APP_ORIGIN}/auth/callback`, skipBrowserRedirect: true },
      });
      if (error || !data.url) {
        await record({ type: "provider_error", reason: "google_callback", request });
        return { ok: false, error: "UNAVAILABLE" };
      }
      return { ok: true, url: data.url };
    },

    async completeGoogle({ code, error, request }) {
      const providerError = () =>
        record({ type: "provider_error", reason: "google_callback", request });
      // Conta Google sem usuário no Supabase: o cadastro é recusado sem dizer o e-mail — por isso
      // não há email_refused aqui (sem e-mail não há hash); a resposta é a mesma recusa.
      if (isSignupDisabled(error)) {
        await providerError();
        return { ok: false, error: "REFUSED" };
      }
      if (error || !code) {
        await providerError();
        return { ok: false, error: "UNAVAILABLE" };
      }
      const exchange = await auth.auth.exchangeCodeForSession(code);
      if (exchange.error) {
        await providerError();
        const refused =
          isSignupDisabled(exchange.error.code) || isSignupDisabled(exchange.error.message);
        return { ok: false, error: refused ? "REFUSED" : "UNAVAILABLE" };
      }
      const established = await establishSession(sessionDeps, { auth, method: "google", request });
      if (!established.ok) return established;
      const next = safeNext(jar.get(NEXT_COOKIE));
      jar.set(NEXT_COOKIE, "", authCookieOptions(env.APP_ENV, { maxAge: 0 }));
      return { ok: true, next };
    },
  };
}
