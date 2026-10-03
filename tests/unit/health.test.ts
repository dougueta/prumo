import { describe, expect, it } from "vitest";
import { checkHealth } from "@/lib/health";

const base = { version: "0.1.0+test", now: () => new Date("2026-10-02T12:00:00.000Z") };

describe("checkHealth (FR-002)", () => {
  it("preview: modo demonstração sem tocar no banco", async () => {
    let pinged = false;
    const result = await checkHealth({
      ...base,
      appEnv: "preview",
      ping: async () => {
        pinged = true;
      },
    });
    expect(pinged).toBe(false);
    expect(result).toEqual({
      httpStatus: 200,
      body: {
        status: "ok",
        version: "0.1.0+test",
        environment: "preview",
        data: { status: "demo", latencyMs: null },
        checkedAt: "2026-10-02T12:00:00.000Z",
      },
    });
  });

  it("banco disponível: ok com latência inteira", async () => {
    const result = await checkHealth({ ...base, appEnv: "production", ping: async () => {} });
    expect(result.httpStatus).toBe(200);
    expect(result.body.status).toBe("ok");
    expect(result.body.data.status).toBe("ok");
    expect(Number.isInteger(result.body.data.latencyMs)).toBe(true);
  });

  it("banco com erro: degraded/503 sem vazar a mensagem", async () => {
    const result = await checkHealth({
      ...base,
      appEnv: "local",
      ping: async () => {
        throw new Error("connection to db.secret-host.supabase.co failed: password=xyz");
      },
    });
    expect(result.httpStatus).toBe(503);
    expect(result.body).toMatchObject({
      status: "degraded",
      data: { status: "unreachable", latencyMs: null },
    });
    expect(JSON.stringify(result.body)).not.toMatch(/secret-host|password/);
  });

  it("banco lento além do timeout: degraded", async () => {
    const result = await checkHealth({
      ...base,
      appEnv: "local",
      timeoutMs: 20,
      ping: () => new Promise((resolve) => setTimeout(resolve, 200)),
    });
    expect(result.httpStatus).toBe(503);
    expect(result.body.data.status).toBe("unreachable");
  });
});
