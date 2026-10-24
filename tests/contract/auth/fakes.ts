import { randomUUID } from "node:crypto";
import { http, HttpResponse } from "msw";
import { server } from "../setup";

export { FakeCookieJar } from "../../helpers/fake-cookie-jar";

/**
 * 006 — Supabase Auth simulado (GoTrue via HTTP, interceptado pelo MSW) + pedido/cookies falsos.
 * O `supabase-js` de verdade roda contra ele: os contratos testam a integração real com a
 * biblioteca, sem rede.
 */
export const SUPABASE_URL = "http://supabase.test";
const AUTH = `${SUPABASE_URL}/auth/v1`;

type User = { id: string; email: string };
type Session = { accessToken: string; refreshToken: string; user: User; sessionId: string };

function b64url(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export class FakeSupabaseAuth {
  users = new Map<string, User>(); // por e-mail
  /** Último código válido por e-mail (novo pedido substitui — FR-004). */
  codes = new Map<string, { code: string; issuedAt: number }>();
  sessions = new Map<string, Session>(); // por access token
  revoked = new Set<string>(); // session ids
  calls: Array<{ method: string; path: string; body?: unknown }> = [];
  /** Respostas forçadas (simular provedor fora do ar). */
  failOtp = false;
  failVerify = false;
  failToken = false;
  /** PKCE: code → e-mail que o "Google" devolve. */
  oauthCodes = new Map<string, string>();

  addUser(email: string): User {
    const user = { id: randomUUID(), email: email.toLowerCase() };
    this.users.set(user.email, user);
    return user;
  }

  issueSession(user: User): Session {
    const sessionId = randomUUID();
    const now = Math.floor(Date.now() / 1000);
    const accessToken = [
      b64url({ alg: "HS256", typ: "JWT" }),
      b64url({
        sub: user.id,
        email: user.email,
        session_id: sessionId,
        role: "authenticated",
        aud: "authenticated",
        iat: now,
        exp: now + 3600,
      }),
      "assinatura-falsa",
    ].join(".");
    const session = { accessToken, refreshToken: randomUUID(), user, sessionId };
    this.sessions.set(accessToken, session);
    return session;
  }

  private sessionJson(s: Session) {
    return {
      access_token: s.accessToken,
      refresh_token: s.refreshToken,
      token_type: "bearer",
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: s.user.id, email: s.user.email, aud: "authenticated", role: "authenticated" },
    };
  }

  private bearer(request: Request): Session | undefined {
    const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
    const session = token ? this.sessions.get(token) : undefined;
    return session && !this.revoked.has(session.sessionId) ? session : undefined;
  }

  install(): this {
    const log = async (request: Request) => {
      const url = new URL(request.url);
      let body: unknown;
      try {
        body = await request.clone().json();
      } catch {
        body = undefined;
      }
      this.calls.push({ method: request.method, path: url.pathname + url.search, body });
    };

    server.use(
      http.post(`${AUTH}/otp`, async ({ request }) => {
        await log(request);
        if (this.failOtp) return HttpResponse.json({ msg: "smtp down" }, { status: 500 });
        const { email, create_user } = (await request.json()) as {
          email: string;
          create_user: boolean;
        };
        if (!this.users.has(email) && !create_user) {
          return HttpResponse.json(
            { code: 422, error_code: "otp_disabled", msg: "Signups not allowed for otp" },
            { status: 422 },
          );
        }
        const code = String(100000 + Math.floor(Math.random() * 900000));
        this.codes.set(email, { code, issuedAt: Date.now() });
        return HttpResponse.json({});
      }),

      http.post(`${AUTH}/verify`, async ({ request }) => {
        await log(request);
        if (this.failVerify) return HttpResponse.json({ msg: "down" }, { status: 503 });
        const { email, token } = (await request.json()) as { email: string; token: string };
        const pending = this.codes.get(email);
        const user = this.users.get(email);
        if (!pending || !user || pending.code !== token) {
          return HttpResponse.json(
            { code: 403, error_code: "otp_expired", msg: "Token has expired or is invalid" },
            { status: 403 },
          );
        }
        this.codes.delete(email); // uso único
        return HttpResponse.json(this.sessionJson(this.issueSession(user)));
      }),

      http.get(`${AUTH}/user`, async ({ request }) => {
        await log(request);
        const session = this.bearer(request);
        if (!session) return HttpResponse.json({ code: 401, msg: "invalid JWT" }, { status: 401 });
        return HttpResponse.json({
          id: session.user.id,
          email: session.user.email,
          aud: "authenticated",
          role: "authenticated",
        });
      }),

      http.post(`${AUTH}/token`, async ({ request }) => {
        await log(request);
        const grant = new URL(request.url).searchParams.get("grant_type");
        if (this.failToken) return HttpResponse.json({ msg: "down" }, { status: 503 });
        if (grant === "pkce") {
          const { auth_code } = (await request.json()) as { auth_code: string };
          const email = this.oauthCodes.get(auth_code);
          this.oauthCodes.delete(auth_code);
          if (!email)
            return HttpResponse.json(
              { error_code: "bad_code_verifier", msg: "invalid" },
              { status: 400 },
            );
          const user = this.users.get(email);
          if (!user) {
            return HttpResponse.json(
              {
                code: 422,
                error_code: "signup_disabled",
                msg: "Signups not allowed for this instance",
              },
              { status: 422 },
            );
          }
          return HttpResponse.json(this.sessionJson(this.issueSession(user)));
        }
        if (grant === "refresh_token") {
          const { refresh_token } = (await request.json()) as { refresh_token: string };
          const old = [...this.sessions.values()].find((s) => s.refreshToken === refresh_token);
          if (!old || this.revoked.has(old.sessionId)) {
            return HttpResponse.json(
              { error_code: "refresh_token_not_found", msg: "invalid" },
              { status: 400 },
            );
          }
          const renewed = { ...old, refreshToken: randomUUID() };
          this.sessions.set(renewed.accessToken, renewed);
          return HttpResponse.json(this.sessionJson(renewed));
        }
        return HttpResponse.json({ msg: "unsupported" }, { status: 400 });
      }),

      http.post(`${AUTH}/logout`, async ({ request }) => {
        await log(request);
        const session = this.bearer(request);
        const scope = new URL(request.url).searchParams.get("scope") ?? "global";
        if (session) {
          if (scope === "global") {
            for (const s of this.sessions.values())
              if (s.user.id === session.user.id) this.revoked.add(s.sessionId);
          } else {
            this.revoked.add(session.sessionId);
          }
        }
        return new HttpResponse(null, { status: 204 });
      }),
    );
    return this;
  }

  callsTo(pathStart: string) {
    return this.calls.filter((c) => c.path.startsWith(`/auth/v1${pathStart}`));
  }
}

export const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

export function requestInfo(ip = "203.0.113.7") {
  return { userAgent: IPHONE_UA, ip, headers: new Headers({ "x-vercel-ip-country": "BR" }) };
}
