import { describe, expect, it } from "vitest";

describe("testes não acessam serviços externos (FR-008)", () => {
  it("bloqueia fetch para hosts externos", async () => {
    await expect(fetch("https://example.com/")).rejects.toThrow(/rede externa bloqueada/i);
  });

  it("permite hosts locais (Supabase local/CI)", async () => {
    // Porta fechada de propósito: o erro deve ser de conexão, não do bloqueio.
    await expect(fetch("http://127.0.0.1:9/")).rejects.not.toThrow(/rede externa bloqueada/i);
  });
});
