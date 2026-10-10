// T031 · research R-02 — JWT RS256 do app prumo-revisor com chave cifrada (FR-009, FR-017).
import { generateKeyPairSync, verify } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  KeyNotEncryptedError,
  WrongPassphraseError,
  createAppJwt,
} from "../../../src/review/app-jwt";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const SENHA = "senha-sintetica-do-teste";
const encryptedPem = privateKey
  .export({ type: "pkcs8", format: "pem", cipher: "aes-256-cbc", passphrase: SENHA })
  .toString();
const plainPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const NOW = new Date("2026-10-06T12:00:00Z");
const nowS = NOW.getTime() / 1000;

const decode = (part: string) => JSON.parse(Buffer.from(part, "base64url").toString("utf8"));

describe("createAppJwt", () => {
  const jwt = createAppJwt({
    clientId: "Iv23liSintetico",
    encryptedPem,
    passphrase: SENHA,
    now: NOW,
  });
  const [h, p, s] = jwt.split(".");

  it("header RS256", () => {
    expect(decode(h)).toEqual({ alg: "RS256", typ: "JWT" });
  });

  it("iat = agora − 60 s, exp ≤ agora + 600 s, iss = client id", () => {
    const payload = decode(p);
    expect(payload.iat).toBe(nowS - 60);
    expect(payload.exp).toBeGreaterThan(nowS);
    expect(payload.exp).toBeLessThanOrEqual(nowS + 600);
    expect(payload.iss).toBe("Iv23liSintetico");
  });

  it("assinatura verificável com a chave pública", () => {
    expect(verify("sha256", Buffer.from(`${h}.${p}`), publicKey, Buffer.from(s, "base64url"))).toBe(
      true,
    );
  });

  it("senha incorreta ⇒ WrongPassphraseError", () => {
    expect(() =>
      createAppJwt({ clientId: "x", encryptedPem, passphrase: "errada", now: NOW }),
    ).toThrow(WrongPassphraseError);
  });

  it("chave sem cifra ⇒ recusada (a senha é a credencial do Doug — FR-017)", () => {
    expect(() =>
      createAppJwt({ clientId: "x", encryptedPem: plainPem, passphrase: SENHA, now: NOW }),
    ).toThrow(KeyNotEncryptedError);
  });

  it("a mensagem de erro nunca contém a senha", () => {
    try {
      createAppJwt({
        clientId: "x",
        encryptedPem,
        passphrase: "segredo-que-nao-pode-vazar",
        now: NOW,
      });
    } catch (e) {
      expect(String(e)).not.toContain("segredo-que-nao-pode-vazar");
    }
  });
});
