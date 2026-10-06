import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import { createServerClient } from "@/lib/supabase/server";
import { pingDatabase } from "@/lib/health";

/**
 * Requer Supabase local (npm run dev:setup) ou o Supabase efêmero do CI.
 * Lê SUPABASE_URL / SUPABASE_SECRET_KEY de .env.local quando não estiverem no ambiente.
 */
function loadLocalEnv() {
  if (process.env.SUPABASE_URL) return;
  try {
    for (const line of readFileSync(".env.local", "utf-8").split(/\r?\n/)) {
      const match = line.match(/^([A-Z_]+)=(.*)$/);
      if (match) process.env[match[1]] ??= match[2];
    }
  } catch {
    throw new Error("Sem Supabase configurado: rode `npm run dev:setup`.");
  }
}

loadLocalEnv();

const spec = parse(readFileSync("specs/001-setup-projeto/contracts/health.openapi.yaml", "utf-8"));
const ajv = new Ajv2020({ strict: false });
addFormats.default(ajv);
const validateHealth = ajv.compile(spec.components.schemas.HealthStatus);

describe("health_ping() no Supabase (FR-002, FR-023)", () => {
  it("executa a função do banco e mede latência", async () => {
    const client = createServerClient();
    await expect(pingDatabase(client)()).resolves.toBeUndefined();
  });
});

describe("GET /api/health contra o contrato OpenAPI", () => {
  it("responde 200 ok em ambiente local e respeita o schema", async () => {
    process.env.APP_ENV = "local";
    const { GET } = await import("@/app/api/health/route");
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    expect(validateHealth(body), JSON.stringify(validateHealth.errors)).toBe(true);
    expect(body).toMatchObject({ status: "ok", environment: "local", data: { status: "ok" } });
    expect(JSON.stringify(body)).not.toContain(process.env.SUPABASE_URL);
  });
});
