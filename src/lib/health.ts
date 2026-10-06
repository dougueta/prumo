import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppEnv } from "@/lib/env";

/** Contrato: specs/001-setup-projeto/contracts/health.openapi.yaml */
export type HealthStatus = {
  status: "ok" | "degraded";
  version: string;
  environment: AppEnv;
  data: { status: "ok" | "unreachable" | "demo"; latencyMs: number | null };
  checkedAt: string;
};

export type HealthDeps = {
  appEnv: AppEnv;
  version: string;
  ping: () => Promise<void>;
  now?: () => Date;
  timeoutMs?: number;
};

export async function checkHealth(
  deps: HealthDeps,
): Promise<{ httpStatus: 200 | 503; body: HealthStatus }> {
  const checkedAt = (deps.now ?? (() => new Date()))().toISOString();
  const base = { version: deps.version, environment: deps.appEnv, checkedAt };

  if (deps.appEnv === "preview") {
    return {
      httpStatus: 200,
      body: { status: "ok", ...base, data: { status: "demo", latencyMs: null } },
    };
  }

  const started = performance.now();
  try {
    await withTimeout(deps.ping(), deps.timeoutMs ?? 3000);
    const latencyMs = Math.max(0, Math.round(performance.now() - started));
    return { httpStatus: 200, body: { status: "ok", ...base, data: { status: "ok", latencyMs } } };
  } catch {
    // Nunca propagar a mensagem do erro: pode conter host, usuário ou outros detalhes internos.
    return {
      httpStatus: 503,
      body: { status: "degraded", ...base, data: { status: "unreachable", latencyMs: null } },
    };
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        reject(new Error("ping failed"));
      },
    );
  });
}

/** Ping real: executa public.health_ping() (também gera atividade contra a pausa do plano gratuito). */
export function pingDatabase(client: SupabaseClient): () => Promise<void> {
  return async () => {
    const { error } = await client.rpc("health_ping");
    if (error) throw new Error("health_ping failed");
  };
}
