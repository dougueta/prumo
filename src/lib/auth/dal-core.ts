import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { DEMO_OWNER_ID } from "@/data/core";
import type { Env } from "@/lib/env";
import { isAllowed } from "./allowlist";
import type { CookieJar } from "./cookie-jar";
import { authCookieOptions } from "./cookie-options";
import { recordEvent, type RequestInfo } from "./events";
import { hasSupabaseAuthCookie } from "./proxy-decision";
import { safeNext } from "./safe-next";
import type { SessionContext } from "./service";
import { ENROLL_COOKIE, NEXT_COOKIE, OTP_EMAIL_COOKIE, readClaims } from "./sessions";
import { evaluateSession } from "./session-state";
import type { AuthStore } from "./store";

/**
 * Núcleo do DAL (contracts/dal.md): uma verificação por pedido, falha fechada, efeitos de
 * encerramento uma vez só. Independente do Next para ser testável; `dal.ts` liga ao pedido real.
 */

export const DEMO_EMAIL = "demo@prumo.invalid";
const DEMO_SESSION_COOKIE = "prumo_demo_sid";
const DEMO_OUT_COOKIE = "prumo_demo_out";

type AdminApi = { signOut(jwt: string, scope?: "global" | "local" | "others"): Promise<unknown> };

export type DalDeps = {
  env: Env;
  store: AuthStore;
  jar: CookieJar;
  now: () => Date;
  /** Cliente do usuário (cookies deste pedido). */
  auth: () => SupabaseClient;
  admin: () => AdminApi;
  /** Caminho interno pedido (para o `next` dos redirecionamentos). */
  path: () => string;
  request?: () => RequestInfo;
};

export type Resolution =
  | { status: "active"; ctx: SessionContext }
  | { status: "locked"; ctx: SessionContext; canUnlock: boolean }
  | { status: "unauthenticated" }
  | { status: "expired" }
  | { status: "unavailable" };

export class SessionUnavailableError extends Error {
  constructor() {
    super("Não foi possível verificar sua sessão. Tente novamente em instantes.");
  }
}

const NO_REQUEST: RequestInfo = { userAgent: null, ip: null, headers: new Headers() };
const SB_COOKIE = /^sb-.+-auth-token(\.\d+)?$/;
const noStore = { "Cache-Control": "private, no-store" };

async function resolveSession(deps: DalDeps): Promise<Resolution> {
  const { env, jar, store } = deps;
  if (env.APP_ENV === "preview") {
    if (jar.get(DEMO_OUT_COOKIE) === "1") return { status: "unauthenticated" };
    const ctx: SessionContext = {
      userId: DEMO_OWNER_ID,
      sessionId: jar.get(DEMO_SESSION_COOKIE) ?? randomUUID(),
      deviceId: "demo",
      email: DEMO_EMAIL,
      isDemo: true,
    };
    return { status: "active", ctx };
  }

  if (!hasSupabaseAuthCookie(jar.getAll().map((c) => c.name))) {
    return { status: "unauthenticated" };
  }
  try {
    const auth = deps.auth();
    const read = await readClaims(auth);
    if ("error" in read) return { status: read.error === "invalid" ? "expired" : "unavailable" };
    const { claims } = read;

    const found = await store.getSession(claims.sessionId);
    const row = found && found.session.ownerId === claims.sub ? found.session : null;
    const now = deps.now();
    const state = evaluateSession({
      row,
      now,
      hasDeviceCredential: found?.hasDeviceCredential ?? false,
      emailAllowed: isAllowed(claims.email, env.AUTH_ALLOWED_EMAILS),
    });

    if (state.state === "EXPIRED" || state.state === "ENDED") {
      // Encerrada agora por avaliação (ociosa, absoluta, allowlist): grava e revoga uma vez só.
      if (row && !row.endedAt && state.reason) {
        const endedNow = await store.endSession(row.id, state.reason, now);
        if (endedNow) {
          await recordEvent(
            {
              type: "session_expired",
              reason: state.reason,
              ownerId: claims.sub,
              sessionId: row.id,
              request: deps.request?.() ?? NO_REQUEST,
            },
            { store, hashSecret: env.AUTH_HASH_SECRET },
          );
          const { data } = await auth.auth.getSession();
          if (data.session) await deps.admin().signOut(data.session.access_token, "local");
        }
      }
      return { status: "expired" };
    }

    const ctx: SessionContext = {
      userId: claims.sub,
      sessionId: row!.id,
      deviceId: row!.deviceId,
      email: claims.email,
      isDemo: false,
    };
    if (state.state === "LOCKED") return { status: "locked", ctx, canUnlock: state.canUnlock };
    if (state.touch) await store.touchSession(row!.id, now);
    return { status: "active", ctx };
  } catch {
    return { status: "unavailable" };
  }
}

export function createDal(deps: DalDeps) {
  let memo: Promise<Resolution> | undefined;
  const resolve = () => (memo ??= resolveSession(deps));
  const next = () => encodeURIComponent(deps.path());

  function clearAuthCookies() {
    for (const { name } of deps.jar.getAll()) {
      if (
        SB_COOKIE.test(name) ||
        name.endsWith("-code-verifier") ||
        [OTP_EMAIL_COOKIE, NEXT_COOKIE, ENROLL_COOKIE].includes(name)
      ) {
        deps.jar.set(name, "", authCookieOptions(deps.env.APP_ENV, { maxAge: 0 }));
      }
    }
  }

  return {
    resolve,

    /** Página (Server Component): contexto ou redirecionamento; sem dados em erro. */
    async requireSession(opts: { allowLocked?: boolean } = {}): Promise<SessionContext> {
      const r = await resolve();
      switch (r.status) {
        case "active":
          return r.ctx;
        case "locked":
          if (opts.allowLocked) return r.ctx;
          redirect(`/desbloquear?next=${next()}`);
        case "unauthenticated":
          redirect(`/entrar?next=${next()}`);
        case "expired":
          redirect(`/auth/sair?next=${next()}`);
        case "unavailable":
          throw new SessionUnavailableError();
      }
    },

    /** Server Action: nunca lança por sessão; sessão encerrada também limpa os cookies. */
    async requireActionSession(
      opts: { allowLocked?: boolean } = {},
    ): Promise<
      | { ok: true; ctx: SessionContext }
      | { ok: false; error: "SESSION_EXPIRED" | "LOCKED" | "UNAVAILABLE" }
    > {
      const r = await resolve();
      if (r.status === "active" || (r.status === "locked" && opts.allowLocked)) {
        return { ok: true, ctx: r.ctx };
      }
      if (r.status === "locked") return { ok: false, error: "LOCKED" };
      if (r.status === "unavailable") return { ok: false, error: "UNAVAILABLE" };
      if (r.status === "expired") clearAuthCookies();
      return { ok: false, error: "SESSION_EXPIRED" };
    },

    /** Route Handler: contexto ou a resposta de erro pronta (401/423/503, sem dados). */
    async requireRouteSession(
      opts: { allowLocked?: boolean } = {},
    ): Promise<{ ok: true; ctx: SessionContext } | { ok: false; response: Response }> {
      const r = await resolve();
      if (r.status === "active" || (r.status === "locked" && opts.allowLocked)) {
        return { ok: true, ctx: r.ctx };
      }
      const fail = (status: number, error: string) => ({
        ok: false as const,
        response: Response.json({ error }, { status, headers: noStore }),
      });
      if (r.status === "locked") return fail(423, "LOCKED");
      if (r.status === "unavailable") return fail(503, "UNAVAILABLE");
      if (r.status === "unauthenticated") return fail(401, "UNAUTHENTICATED");
      clearAuthCookies();
      return fail(401, "SESSION_EXPIRED");
    },

    /** FR-013: a gravação só roda com sessão ativa. */
    async withActionSession<T>(
      action: (ctx: SessionContext) => Promise<T> | T,
    ): Promise<
      { ok: true; value: T } | { ok: false; error: "SESSION_EXPIRED" | "LOCKED" | "UNAVAILABLE" }
    > {
      const session = await this.requireActionSession();
      if (!session.ok) return session;
      return { ok: true, value: await action(session.ctx) };
    },

    /** Cliente com o JWT do usuário (RLS). Sempre depois da verificação de sessão. */
    async getDataClient(): Promise<SupabaseClient> {
      const r = await resolve();
      if (r.status !== "active") throw new Error("Sem sessão ativa.");
      if (r.ctx.isDemo) throw new Error("Modo demonstração não tem banco (ADR 0006).");
      return deps.auth();
    },

    /**
     * `/auth/sair` (auth-flows §2.1): só limpa sessão que já acabou. Ativa ou bloqueada ⇒ apenas
     * volta ao `next` (não serve para deslogar alguém por CSRF). Devolve o destino.
     */
    async signOutExpired(rawNext: string | null): Promise<string> {
      const target = safeNext(rawNext);
      const r = await resolve();
      if (r.status === "active" || r.status === "locked" || r.status === "unavailable") {
        return target;
      }
      clearAuthCookies();
      return `/entrar?next=${encodeURIComponent(target)}&erro=expirada`;
    },
  };
}

export type Dal = ReturnType<typeof createDal>;
