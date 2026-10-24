import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

/**
 * 006 · T071 (FR-022) — nada da configuração do servidor chega ao navegador: nenhum arquivo
 * entregue ao cliente (`.next/static/**`) contém a allowlist, segredos ou dados do Supabase.
 * Roda depois do `next build` do job E2E, com os valores reais daquele ambiente.
 */
const NAMES = [
  "AUTH_ALLOWED_EMAILS",
  "AUTH_HASH_SECRET",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_URL",
] as const;

function envLocal(): Record<string, string> {
  try {
    return Object.fromEntries(
      readFileSync(".env.local", "utf-8")
        .split(/\r?\n/)
        .map((line) => line.match(/^([A-Z_]+)=(.*)$/))
        .filter((m): m is RegExpMatchArray => m !== null)
        .map(([, key, value]) => [key, value]),
    );
  } catch {
    return {};
  }
}

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? files(full) : [full];
  });
}

test("o código entregue ao navegador não contém configuração do servidor", () => {
  const env = { ...envLocal(), ...process.env } as Record<string, string | undefined>;
  const needles: Array<[string, string]> = [];
  for (const name of NAMES) {
    const value = env[name];
    expect(value, `${name} precisa estar definido para a guarda valer`).toBeTruthy();
    const parts =
      name === "AUTH_ALLOWED_EMAILS" ? value!.split(",").map((e) => e.trim()) : [value!];
    for (const part of parts) if (part) needles.push([name, part]);
  }

  const bundle = files(".next/static");
  expect(bundle.length).toBeGreaterThan(0);
  const leaks: string[] = [];
  for (const file of bundle) {
    const content = readFileSync(file, "utf-8");
    for (const [name, value] of needles) {
      if (content.includes(value)) leaks.push(`${name} em ${path.relative(".next/static", file)}`);
    }
  }
  expect(leaks).toEqual([]);
});
