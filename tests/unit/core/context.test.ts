import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it } from "vitest";
import {
  CoreError,
  createCoreStore,
  DEMO_OWNER_ID,
  getCoreStore,
  registerOwnerContextProvider,
} from "@/data/core";
import { clearOwnerContextProvider, resolveCoreStore } from "@/data/core/context";

// 004 · T016 — contracts/owner-context.md.
const OWNER = "6f1c1f0e-0d51-4a43-9a0c-4c4a3a4b7d10";
const fakeClient = {} as SupabaseClient;

afterEach(() => clearOwnerContextProvider());

describe("DEMO_OWNER_ID", () => {
  it("é o UUID fixo do contrato", () => {
    expect(DEMO_OWNER_ID).toBe("00000000-0000-4000-8000-00000000d3e0");
  });
});

describe("createCoreStore", () => {
  it("user e service usam Supabase com o dono do contexto", () => {
    const user = createCoreStore({ kind: "user", ownerId: OWNER, client: fakeClient });
    expect(user).toMatchObject({ mode: "supabase", ownerId: OWNER });
    const service = createCoreStore({ kind: "service", ownerId: OWNER, client: fakeClient });
    expect(service).toMatchObject({ mode: "supabase", ownerId: OWNER });
  });

  it("demo usa memória com DEMO_OWNER_ID e uma loja por sessão", () => {
    const a = createCoreStore({ kind: "demo", sessionId: "sessao-a" });
    expect(a).toMatchObject({ mode: "memory", ownerId: DEMO_OWNER_ID });
    expect(createCoreStore({ kind: "demo", sessionId: "sessao-a" })).toBe(a);
    expect(createCoreStore({ kind: "demo", sessionId: "sessao-b" })).not.toBe(a);
  });
});

describe("getCoreStore", () => {
  it("com provedor registrado usa current() (user)", async () => {
    registerOwnerContextProvider({
      current: async () => ({ kind: "user", ownerId: OWNER, client: fakeClient }),
    });
    expect(await getCoreStore()).toMatchObject({ mode: "supabase", ownerId: OWNER });
  });

  it("com provedor registrado usa current() (demo)", async () => {
    registerOwnerContextProvider({ current: async () => ({ kind: "demo", sessionId: "s-9" }) });
    const store = await getCoreStore();
    expect(store).toMatchObject({ mode: "memory", ownerId: DEMO_OWNER_ID });
    expect(store).toBe(createCoreStore({ kind: "demo", sessionId: "s-9" }));
  });

  it("provedor sem sessão propaga owner_required", async () => {
    registerOwnerContextProvider({
      current: async () => {
        throw new CoreError("owner_required");
      },
    });
    await expect(getCoreStore()).rejects.toMatchObject({ code: "owner_required" });
  });

  it("sem provedor em preview: memória com a sessão do cookie prumo_demo_sid", async () => {
    const store = await resolveCoreStore({
      appEnv: () => "preview",
      readDemoSessionId: async () => "cookie-123",
    });
    expect(store).toMatchObject({ mode: "memory", ownerId: DEMO_OWNER_ID });
    expect(store).toBe(createCoreStore({ kind: "demo", sessionId: "cookie-123" }));
  });

  it("sem provedor em preview e sem cookie: sessão efêmera nova", async () => {
    const deps = { appEnv: () => "preview" as const, readDemoSessionId: async () => undefined };
    const first = await resolveCoreStore(deps);
    const second = await resolveCoreStore(deps);
    expect(first.mode).toBe("memory");
    expect(first).not.toBe(second);
  });

  it.each(["local", "production"] as const)("sem provedor em %s ⇒ owner_required", async (env) => {
    await expect(
      resolveCoreStore({ appEnv: () => env, readDemoSessionId: async () => "x" }),
    ).rejects.toMatchObject({ code: "owner_required" });
  });
});
