import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../setup";

describe("projeto contract (MSW, sem rede)", () => {
  it("requisição sem handler falha em vez de sair para a rede", async () => {
    await expect(fetch("http://127.0.0.1:57321/auth/v1/health")).rejects.toThrow();
  });

  it("handler registrado no teste responde", async () => {
    server.use(http.get("http://supabase.test/auth/v1/health", () => HttpResponse.json({ ok: 1 })));
    const res = await fetch("http://supabase.test/auth/v1/health");
    expect(await res.json()).toEqual({ ok: 1 });
  });
});
