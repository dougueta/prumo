import { validation } from "./errors";

/** Cursores opacos de paginação (base64url de JSON), comuns às duas implementações. */

export function encodeCursor(value: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export function decodeCursor<T extends Record<string, unknown>>(
  cursor: string,
  shape: (value: Record<string, unknown>) => value is T,
): T {
  try {
    const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf-8"));
    if (value && typeof value === "object" && shape(value)) return value;
  } catch {
    // cai no erro abaixo
  }
  throw validation("cursor");
}
