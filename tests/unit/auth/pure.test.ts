import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { isAllowed, normalizeEmail } from "@/lib/auth/allowlist";
import { hmacHex, maskEmail } from "@/lib/auth/crypto";
import { describeDevice, geoFromHeaders } from "@/lib/auth/device";
import { safeNext } from "@/lib/auth/safe-next";

/** 006 · T006 (FR-001, FR-006, FR-018) — funções puras de auth. */

describe("normalizeEmail / isAllowed (FR-001)", () => {
  const allowlist = ["doug@example.test"];

  it("ignora maiúsculas e espaços nas pontas", () => {
    expect(normalizeEmail("  Doug@Example.TEST \n")).toBe("doug@example.test");
    expect(isAllowed(" DOUG@example.test", allowlist)).toBe(true);
  });

  it("recusa qualquer outro e-mail, inclusive parecidos", () => {
    for (const email of ["doug@example.tes", "doug+x@example.test", "xdoug@example.test", ""]) {
      expect(isAllowed(email, allowlist), email).toBe(false);
    }
  });

  it("aceita qualquer e-mail de uma allowlist com vários", () => {
    expect(isAllowed("b@x.io", ["a@x.io", "b@x.io"])).toBe(true);
  });
});

describe("hmacHex", () => {
  it("é HMAC-SHA256 em hex (64 caracteres) e depende do segredo", () => {
    const secret = "s".repeat(32);
    expect(hmacHex(secret, "doug@example.test")).toBe(
      createHmac("sha256", secret).update("doug@example.test").digest("hex"),
    );
    expect(hmacHex(secret, "x")).toMatch(/^[0-9a-f]{64}$/);
    expect(hmacHex("t".repeat(32), "x")).not.toBe(hmacHex(secret, "x"));
  });
});

describe("maskEmail (FR-018)", () => {
  it.each([
    ["fulano@gmail.com", "fu***@g***.com"],
    ["estranho@exemplo.com", "es***@e***.com"],
    ["Maria.Silva@Empresa.com.br", "ma***@e***.com.br"],
    ["ab@x.io", "a***@x***.io"],
    ["a@b.co", "a***@b***.co"],
  ])("%s ⇒ %s", (email, masked) => {
    expect(maskEmail(email)).toBe(masked);
  });

  it("nunca contém o e-mail completo nem o usuário inteiro", () => {
    const masked = maskEmail("segredo.pessoal@provedor.net");
    expect(masked).not.toContain("segredo.pessoal");
    expect(masked).not.toContain("provedor");
  });
});

describe("safeNext (FR-006)", () => {
  it.each([
    ["/extrato", "/extrato"],
    ["/mais/seguranca?aba=1#topo", "/mais/seguranca?aba=1#topo"],
    ["/", "/"],
  ])("aceita caminho interno %s", (raw, expected) => {
    expect(safeNext(raw)).toBe(expected);
  });

  it.each([
    ["//evil.example"],
    ["/\\evil.example"],
    ["https://evil.example"],
    ["/redir?to=https://evil.example"],
    ["evil.example"],
    ["javascript:alert(1)"],
    ["/\t/evil.example"],
    ["/\n/evil.example"],
    ["/x\\y"],
    ["/entrar"],
    ["/entrar/codigo"],
    ["/entrar?next=/x"],
    ["/auth/sair"],
    ["/auth/callback?code=x"],
    ["/desbloquear"],
    [""],
    [null],
    [undefined],
    ["/" + "a".repeat(512)],
  ])("recusa %j ⇒ /", (raw) => {
    expect(safeNext(raw)).toBe("/");
  });

  it("aceita até 512 caracteres", () => {
    const path = "/" + "a".repeat(511);
    expect(safeNext(path)).toBe(path);
  });
});

describe("describeDevice", () => {
  it.each([
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
      "iPhone · Safari",
    ],
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1",
      "iPhone · Chrome",
    ],
    [
      "Mozilla/5.0 (Linux; Android 15; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
      "Android · Chrome",
    ],
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
      "Windows · Edge",
    ],
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
      "Windows · Chrome",
    ],
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0",
      "Windows · Firefox",
    ],
    [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
      "macOS · Safari",
    ],
    [
      "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
      "iPad · Safari",
    ],
  ])("%s", (ua, label) => {
    expect(describeDevice(ua)).toBe(label);
  });

  it("UA ausente ou estranho ⇒ descrição genérica, sempre ≤ 80 caracteres", () => {
    expect(describeDevice(null)).toBe("Dispositivo desconhecido");
    expect(describeDevice("curl/8.0")).toBe("Dispositivo desconhecido");
    expect(describeDevice("x".repeat(5000)).length).toBeLessThanOrEqual(80);
  });
});

describe("geoFromHeaders (R-13)", () => {
  it("monta 'Cidade, PAÍS' a partir dos cabeçalhos da Vercel (cidade codificada)", () => {
    const headers = new Headers({
      "x-vercel-ip-city": "S%C3%A3o%20Paulo",
      "x-vercel-ip-country": "BR",
    });
    expect(geoFromHeaders(headers)).toBe("São Paulo, BR");
  });

  it("só o país quando não há cidade; nulo sem cabeçalhos (local)", () => {
    expect(geoFromHeaders(new Headers({ "x-vercel-ip-country": "BR" }))).toBe("BR");
    expect(geoFromHeaders(new Headers())).toBeNull();
  });

  it("nunca passa de 80 caracteres nem quebra com codificação inválida", () => {
    const headers = new Headers({ "x-vercel-ip-city": "%E0%A4%A", "x-vercel-ip-country": "BR" });
    expect(() => geoFromHeaders(headers)).not.toThrow();
    const long = new Headers({ "x-vercel-ip-city": "a".repeat(200), "x-vercel-ip-country": "BR" });
    expect(geoFromHeaders(long)!.length).toBeLessThanOrEqual(80);
  });
});
