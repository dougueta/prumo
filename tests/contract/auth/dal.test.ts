import { describe, expect, it, vi } from "vitest";
import { createDal, type DalDeps } from "@/lib/auth/dal-core";
import { MemoryAuthStore } from "@/lib/auth/memory-store";
import { createAuthAdminFor, createAuthClientFor } from "@/lib/auth/supabase-clients";
import { FakeCookieJar } from "./fakes";
import { DOUG, harness, makeEnv } from "./harness";

/**
 * 006 · T063 (FR-007, FR-011, FR-013) — contracts/dal.md: matriz página × Server Action × Route
 * Handler, falha fechada, efeitos uma vez só; e `/auth/sair` (auth-flows §2.1).
 */
const MIN = 60_000;
const DAY = 24 * 60 * MIN;

/** Entra de verdade (código) e devolve um DAL sobre os mesmos cookies, store e Auth simulado. */
async function signedIn(opts: { env?: ReturnType<typeof makeEnv> } = {}) {
  const store = new MemoryAuthStore();
  const jar = new FakeCookieJar();
  const h = harness({ store, jar });
  await h.service.requestCode({ email: DOUG, request: h.request });
  const code = h.fake.codes.get(DOUG)!.code;
  const result = await h.service.verifyCode({ code, next: "/", request: h.request });
  if (!result.ok) throw new Error("login falhou");
  const user = h.fake.users.get(DOUG)!;
  const [session] = await store.listSessions(user.id);
  let now = new Date();
  const env = opts.env ?? h.env;
  const deps: DalDeps = {
    env,
    store,
    jar,
    now: () => now,
    auth: () => createAuthClientFor(env, jar),
    admin: () => createAuthAdminFor(env),
    path: () => "/mais/seguranca",
  };
  return {
    ...h,
    user,
    session,
    dal: createDal(deps),
    deps,
    advance: (ms: number) => {
      now = new Date(now.getTime() + ms);
    },
  };
}

function redirectTarget(error: unknown): string {
  const digest = (error as { digest?: string }).digest ?? "";
  if (!digest.startsWith("NEXT_REDIRECT")) throw error;
  return digest.split(";")[2];
}

async function pageOutcome(dal: ReturnType<typeof createDal>, opts?: { allowLocked?: boolean }) {
  try {
    return { ctx: await dal.requireSession(opts) };
  } catch (error) {
    return { redirect: redirectTarget(error) };
  }
}

const SB = /^sb-.+-auth-token(\.\d+)?$/;

describe("sessão ativa", () => {
  it("as três superfícies devolvem o contexto", async () => {
    const s = await signedIn();
    const ctx = {
      userId: s.user.id,
      sessionId: s.session.id,
      deviceId: s.session.deviceId,
      email: DOUG,
      isDemo: false,
    };
    expect(await pageOutcome(s.dal)).toEqual({ ctx });
    expect(await s.dal.requireActionSession()).toEqual({ ok: true, ctx });
    expect(await s.dal.requireRouteSession()).toEqual({ ok: true, ctx });
  });

  it("atualiza last_active_at só depois de 60 s (throttle)", async () => {
    const s = await signedIn();
    const before = (await s.store.getSession(s.session.id))!.session.lastActiveAt;
    s.advance(30_000);
    await s.dal.requireSession();
    expect((await s.store.getSession(s.session.id))!.session.lastActiveAt).toEqual(before);
    s.advance(40_000);
    const fresh = createDal(s.deps);
    await fresh.requireSession();
    expect(
      (await s.store.getSession(s.session.id))!.session.lastActiveAt.getTime(),
    ).toBeGreaterThan(before.getTime());
  });

  it("é memoizada por pedido: uma verificação para várias chamadas", async () => {
    const s = await signedIn();
    const spy = vi.spyOn(s.store, "getSession");
    await s.dal.requireSession();
    await s.dal.requireSession();
    await s.dal.getDataClient();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe("sem sessão", () => {
  it("sem cookie: página ⇒ /entrar?next=…, ação ⇒ SESSION_EXPIRED, rota ⇒ 401 UNAUTHENTICATED", async () => {
    const env = makeEnv();
    const jar = new FakeCookieJar();
    const dal = createDal({
      env,
      store: new MemoryAuthStore(),
      jar,
      now: () => new Date(),
      auth: () => createAuthClientFor(env, jar),
      admin: () => createAuthAdminFor(env),
      path: () => "/mais/seguranca",
    });
    expect(await pageOutcome(dal)).toEqual({ redirect: "/entrar?next=%2Fmais%2Fseguranca" });
    expect(await dal.requireActionSession()).toEqual({ ok: false, error: "SESSION_EXPIRED" });
    const route = await dal.requireRouteSession();
    expect(route.ok).toBe(false);
    if (!route.ok) {
      expect(route.response.status).toBe(401);
      expect(await route.response.json()).toEqual({ error: "UNAUTHENTICATED" });
    }
  });

  it("getDataClient sem sessão nunca devolve cliente", async () => {
    const env = makeEnv();
    const jar = new FakeCookieJar();
    const dal = createDal({
      env,
      store: new MemoryAuthStore(),
      jar,
      now: () => new Date(),
      auth: () => createAuthClientFor(env, jar),
      admin: () => createAuthAdminFor(env),
      path: () => "/",
    });
    await expect(dal.getDataClient()).rejects.toThrow();
  });
});

describe("sessão encerrada, expirada ou inválida", () => {
  it("encerrada (logout em outro lugar) com JWT válido: página ⇒ /auth/sair (sem laço)", async () => {
    const s = await signedIn();
    await s.store.endSession(s.session.id, "logout_all", new Date());
    expect(await pageOutcome(s.dal)).toEqual({ redirect: "/auth/sair?next=%2Fmais%2Fseguranca" });
  });

  it("ação ⇒ SESSION_EXPIRED + cookies sb-* apagados; rota ⇒ 401 SESSION_EXPIRED", async () => {
    const s = await signedIn();
    await s.store.endSession(s.session.id, "logout_all", new Date());
    expect(await s.dal.requireActionSession()).toEqual({ ok: false, error: "SESSION_EXPIRED" });
    expect(s.jar.names().some((n) => SB.test(n))).toBe(false);

    const t = await signedIn();
    await t.store.endSession(t.session.id, "logout_all", new Date());
    const route = await t.dal.requireRouteSession();
    expect(!route.ok && route.response.status).toBe(401);
    expect(!route.ok && (await route.response.json())).toEqual({ error: "SESSION_EXPIRED" });
  });

  it("30 dias sem uso ⇒ encerra idle_30d, evento session_expired uma vez, revoga no Supabase", async () => {
    const s = await signedIn();
    s.advance(31 * DAY);
    await s.dal.requireActionSession();
    await createDal(s.deps).requireActionSession();
    const row = (await s.store.getSession(s.session.id))!.session;
    expect(row.endReason).toBe("idle_30d");
    const expired = (
      await s.store.listEvents({ ownerId: s.user.id, now: new Date(Date.now() + 31 * DAY) })
    ).filter((e) => e.type === "session_expired");
    expect(expired).toHaveLength(1);
    expect(expired[0].reason).toBe("idle_30d");
    expect(s.fake.revoked.has(s.session.id)).toBe(true);
  });

  it("90 dias desde a entrada ⇒ absolute_90d mesmo com uso recente", async () => {
    const s = await signedIn();
    for (let d = 0; d < 9; d++) {
      s.advance(10 * DAY);
      await s.store.touchSession(s.session.id, s.deps.now());
    }
    await s.dal.requireActionSession();
    expect((await s.store.getSession(s.session.id))!.session.endReason).toBe("absolute_90d");
  });

  it("e-mail removido da allowlist ⇒ allowlist_removed", async () => {
    const s = await signedIn();
    const dal = createDal({
      ...s.deps,
      env: makeEnv({ AUTH_ALLOWED_EMAILS: ["outra@example.test"] }),
    });
    expect(await dal.requireActionSession()).toEqual({ ok: false, error: "SESSION_EXPIRED" });
    expect((await s.store.getSession(s.session.id))!.session.endReason).toBe("allowlist_removed");
  });

  it("JWT revogado no provedor ⇒ expirada", async () => {
    const s = await signedIn();
    s.fake.revoked.add(s.session.id);
    expect(await s.dal.requireActionSession()).toEqual({ ok: false, error: "SESSION_EXPIRED" });
  });

  it("sessão de outro dono com o mesmo id nunca vale", async () => {
    const s = await signedIn();
    const row = (await s.store.getSession(s.session.id))!.session;
    (row as { ownerId: string }).ownerId = "outro";
    vi.spyOn(s.store, "getSession").mockResolvedValue({ session: row, hasDeviceCredential: false });
    expect(await s.dal.requireActionSession()).toEqual({ ok: false, error: "SESSION_EXPIRED" });
  });
});

describe("bloqueio por inatividade", () => {
  it("16 min ⇒ página /desbloquear?next=…, ação LOCKED, rota 423; last_active_at intocado", async () => {
    const s = await signedIn();
    const before = (await s.store.getSession(s.session.id))!.session.lastActiveAt;
    s.advance(16 * MIN);
    expect(await pageOutcome(s.dal)).toEqual({ redirect: "/desbloquear?next=%2Fmais%2Fseguranca" });
    expect(await s.dal.requireActionSession()).toEqual({ ok: false, error: "LOCKED" });
    const route = await s.dal.requireRouteSession();
    expect(!route.ok && route.response.status).toBe(423);
    expect((await s.store.getSession(s.session.id))!.session.lastActiveAt).toEqual(before);
  });

  it("allowLocked devolve o contexto (tela de desbloqueio)", async () => {
    const s = await signedIn();
    s.advance(16 * MIN);
    expect((await pageOutcome(s.dal, { allowLocked: true })).ctx?.sessionId).toBe(s.session.id);
  });
});

describe("falha fechada", () => {
  it("banco indisponível ⇒ página com erro (sem dados), ação UNAVAILABLE, rota 503", async () => {
    const s = await signedIn();
    vi.spyOn(s.store, "getSession").mockRejectedValue(new Error("db down"));
    await expect(s.dal.requireSession()).rejects.toThrow(/verificar sua sessão/);
    const t = createDal(s.deps);
    expect(await t.requireActionSession()).toEqual({ ok: false, error: "UNAVAILABLE" });
    const route = await createDal(s.deps).requireRouteSession();
    expect(!route.ok && route.response.status).toBe(503);
  });
});

describe("withActionSession — a ação não roda sem sessão (FR-013)", () => {
  it("sessão encerrada ⇒ o callback de gravação não executa", async () => {
    const s = await signedIn();
    await s.store.endSession(s.session.id, "logout_all", new Date());
    const write = vi.fn();
    expect(await s.dal.withActionSession(write)).toEqual({ ok: false, error: "SESSION_EXPIRED" });
    expect(write).not.toHaveBeenCalled();
  });

  it("sessão ativa ⇒ executa com o contexto", async () => {
    const s = await signedIn();
    expect(await s.dal.withActionSession(async (ctx) => ctx.email)).toEqual({
      ok: true,
      value: DOUG,
    });
  });
});

describe("/auth/sair (signOutExpired)", () => {
  it("sessão ATIVA ⇒ não desloga (anti-CSRF), só redireciona para o next", async () => {
    const s = await signedIn();
    expect(await s.dal.signOutExpired("/extrato")).toBe("/extrato");
    expect(s.jar.names().some((n) => SB.test(n))).toBe(true);
  });

  it("sessão LOCKED ⇒ também não desloga", async () => {
    const s = await signedIn();
    s.advance(16 * MIN);
    expect(await s.dal.signOutExpired("/extrato")).toBe("/extrato");
    expect(s.jar.names().some((n) => SB.test(n))).toBe(true);
  });

  it("sessão encerrada ⇒ apaga cookies de auth e manda para /entrar com erro=expirada", async () => {
    const s = await signedIn();
    s.jar.set("prumo_next", "/x", { maxAge: 600 });
    await s.store.endSession(s.session.id, "logout_all", new Date());
    expect(await s.dal.signOutExpired("/extrato")).toBe("/entrar?next=%2Fextrato&erro=expirada");
    expect(s.jar.names().filter((n) => SB.test(n) || n === "prumo_next")).toEqual([]);
    expect(s.jar.get("prumo_device")).toBeDefined();
  });

  it("next inseguro vira /", async () => {
    const s = await signedIn();
    await s.store.endSession(s.session.id, "logout_all", new Date());
    expect(await s.dal.signOutExpired("//evil.example")).toBe("/entrar?next=%2F&erro=expirada");
  });
});
