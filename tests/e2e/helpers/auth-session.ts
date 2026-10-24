import { readFileSync } from "node:fs";
import { expect, type Browser, type Page } from "@playwright/test";
import { waitForCode } from "./mailpit";

/**
 * 006 · T004 — entrada completa por código (OTP via Mailpit) e `storageState` reutilizável pelos
 * E2E que só precisam de uma sessão ativa (home, pwa, shell…).
 */

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

/** E-mails da allowlist do servidor de teste (CI: sintéticos `@example.test`). */
export function allowedEmails(): string[] {
  const raw = process.env.AUTH_ALLOWED_EMAILS ?? envLocal().AUTH_ALLOWED_EMAILS ?? "";
  const emails = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (emails.length === 0) throw new Error("AUTH_ALLOWED_EMAILS vazio — rode npm run dev:setup");
  return emails;
}

/** Faz a entrada completa por código na página dada e espera chegar a `expectPath`. */
export async function signInWithCode(
  page: Page,
  { email = allowedEmails()[0], next, expectPath = next ?? "/" } = {} as {
    email?: string;
    next?: string;
    expectPath?: string;
  },
): Promise<void> {
  const requestedAt = new Date();
  await page.goto(next ? `/entrar?next=${encodeURIComponent(next)}` : "/entrar");
  await page.getByLabel("E-mail").fill(email);
  await page.getByRole("button", { name: "Receber código" }).click();
  await expect(page).toHaveURL(/\/entrar\/codigo/);
  const code = await waitForCode(email, { after: requestedAt });
  await page.getByLabel("Código").fill(code);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL((url) => url.pathname === expectPath);
}

/** Cria um contexto novo, entra e grava o `storageState` em `path`. */
export async function saveSignedInState(browser: Browser, baseURL: string, path: string) {
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  await signInWithCode(page);
  await context.storageState({ path });
  await context.close();
}
