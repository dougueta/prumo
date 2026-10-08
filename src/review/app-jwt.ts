// Feature 002 · research R-02 — JWT RS256 do GitHub App prumo-revisor (node:crypto, sem
// dependência nova). A chave privada é PKCS#8 cifrada; a senha é digitada pelo Doug (FR-017).
import { createPrivateKey, sign, type KeyObject } from "node:crypto";

export class WrongPassphraseError extends Error {
  constructor() {
    super("senha da chave incorreta");
    this.name = "WrongPassphraseError";
  }
}

export class KeyNotEncryptedError extends Error {
  constructor() {
    super("a chave do prumo-revisor precisa estar cifrada com senha (ver quickstart §1.2)");
    this.name = "KeyNotEncryptedError";
  }
}

export interface AppJwtInput {
  clientId: string;
  encryptedPem: string;
  passphrase: string;
  now: Date;
}

const b64url = (v: string | Buffer) => Buffer.from(v).toString("base64url");

function loadKey(pem: string, passphrase: string): KeyObject {
  if (!pem.includes("-----BEGIN ENCRYPTED PRIVATE KEY-----")) throw new KeyNotEncryptedError();
  try {
    return createPrivateKey({ key: pem, format: "pem", passphrase });
  } catch {
    throw new WrongPassphraseError();
  }
}

/** JWT do app: `iat` = agora − 60 s, `exp` = agora + 9 min, `iss` = Client ID. */
export function createAppJwt(input: AppJwtInput): string {
  const key = loadKey(input.encryptedPem, input.passphrase);
  const now = Math.floor(input.now.getTime() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify({ iat: now - 60, exp: now + 9 * 60, iss: input.clientId }));
  const signature = sign("sha256", Buffer.from(`${header}.${payload}`), key);
  return `${header}.${payload}.${b64url(signature)}`;
}
