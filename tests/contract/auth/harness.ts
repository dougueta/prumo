import { vi } from "vitest";
import { MemoryAuthStore } from "@/lib/auth/memory-store";
import { createSupabaseAuthService, type ServerAuthEnv } from "@/lib/auth/supabase-service";
import { FakeCookieJar, FakeSupabaseAuth, requestInfo, SUPABASE_URL } from "./fakes";

/** Monta o serviço real (Supabase) contra o Auth simulado, store em memória e relógio controlado. */
export const DOUG = "doug@example.test";
export const HASH_SECRET = "h".repeat(40);

export function makeEnv(overrides: Partial<ServerAuthEnv> = {}): ServerAuthEnv {
  return {
    APP_ENV: "local",
    SUPABASE_URL,
    SUPABASE_SECRET_KEY: "sb_secret_test",
    SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
    AUTH_ALLOWED_EMAILS: [DOUG],
    AUTH_HASH_SECRET: HASH_SECRET,
    APP_ORIGIN: "http://localhost:3100",
    ...overrides,
  };
}

export function harness({
  env = makeEnv(),
  users = [DOUG],
  store = new MemoryAuthStore(),
  jar = new FakeCookieJar(),
  ip = "203.0.113.7",
}: {
  env?: ServerAuthEnv;
  users?: string[];
  store?: MemoryAuthStore;
  jar?: FakeCookieJar;
  ip?: string;
} = {}) {
  const fake = new FakeSupabaseAuth().install();
  for (const email of users) fake.addUser(email);
  const sleeps: number[] = [];
  const bootstrap = vi.fn(async () => {});
  const service = createSupabaseAuthService({
    env,
    store,
    jar,
    clock: {
      now: () => new Date(),
      elapsed: () => performance.now(),
      sleep: async (ms) => {
        sleeps.push(ms);
      },
    },
    bootstrap,
  });
  return { service, fake, store, jar, sleeps, bootstrap, env, request: requestInfo(ip) };
}
