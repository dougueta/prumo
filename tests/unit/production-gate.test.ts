import { describe, expect, it } from "vitest";
import { evaluateGate, isExemptPath, safeEqual } from "@/lib/production-gate";

const credentials = { user: "doug", password: "uma-senha-bem-longa-com-20+" };
const basic = (user: string, password: string) =>
  `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;

describe("trava provisória de produção (FR-013, contracts/production-gate.md)", () => {
  it("não se aplica fora de produção", () => {
    expect(evaluateGate({ appEnv: "local", path: "/", authorization: null, credentials })).toBe(
      "allow",
    );
    expect(evaluateGate({ appEnv: "preview", path: "/", authorization: null, credentials })).toBe(
      "allow",
    );
  });

  it("bloqueia sem Authorization", () => {
    expect(
      evaluateGate({ appEnv: "production", path: "/", authorization: null, credentials }),
    ).toBe("challenge");
  });

  it("bloqueia com credenciais erradas", () => {
    for (const authorization of [
      basic("doug", "errada"),
      basic("outro", credentials.password),
      "Basic !!!não-base64",
      "Bearer token",
    ]) {
      expect(evaluateGate({ appEnv: "production", path: "/", authorization, credentials })).toBe(
        "challenge",
      );
    }
  });

  it("libera com credenciais corretas", () => {
    expect(
      evaluateGate({
        appEnv: "production",
        path: "/",
        authorization: basic(credentials.user, credentials.password),
        credentials,
      }),
    ).toBe("allow");
  });

  it("isenta health, manifesto, service worker, ícones e página offline", () => {
    for (const path of [
      "/api/health",
      "/manifest.webmanifest",
      "/sw.js",
      "/icons/icon-192.png",
      "/~offline",
    ]) {
      expect(isExemptPath(path), path).toBe(true);
      expect(evaluateGate({ appEnv: "production", path, authorization: null, credentials })).toBe(
        "allow",
      );
    }
    expect(isExemptPath("/api/healthz")).toBe(false);
    expect(isExemptPath("/icons-falsos")).toBe(false);
  });

  it("compara em tempo constante (mesmo resultado independente do tamanho)", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(safeEqual("", "")).toBe(true);
  });
});
