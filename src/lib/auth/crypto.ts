import { createHmac } from "node:crypto";
import { normalizeEmail } from "./allowlist";

/** HMAC-SHA256 em hex: chave de e-mail e IP nos eventos e no rate limit (R-09). */
export function hmacHex(secret: string, value: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

// Domínios de segundo nível comuns sob TLD de país (ex.: .com.br) — mantidos inteiros na máscara.
const SECOND_LEVEL = new Set(["com", "net", "org", "gov", "edu", "co", "ac"]);

/** `fulano@gmail.com` ⇒ `fu***@g***.com` (FR-018: e-mail de terceiros só mascarado). */
export function maskEmail(email: string): string {
  const [local = "", domain = ""] = normalizeEmail(email).split("@");
  const labels = domain.split(".").filter(Boolean);
  const tldCount =
    labels.length >= 3 && labels.at(-1)!.length === 2 && SECOND_LEVEL.has(labels.at(-2)!) ? 2 : 1;
  const tld = labels.slice(-tldCount).join(".");
  const name = labels.slice(0, -tldCount).join(".");
  const maskedLocal = local.slice(0, local.length <= 2 ? 1 : 2) + "***";
  return `${maskedLocal}@${name.slice(0, 1)}***.${tld}`;
}
