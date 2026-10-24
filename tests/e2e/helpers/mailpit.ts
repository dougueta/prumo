/**
 * 006 · T004 — leitura do Mailpit do Supabase local/CI (porta 57324). Só para E2E: os e-mails
 * de código nunca saem da máquina.
 */
const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:57324";

type Message = { ID: string; Snippet: string; Created: string };

async function search(email: string): Promise<Message[]> {
  const query = encodeURIComponent(`to:"${email}"`);
  const res = await fetch(`${MAILPIT_URL}/api/v1/search?query=${query}`);
  if (!res.ok) throw new Error(`Mailpit respondeu ${res.status}`);
  const body = (await res.json()) as { messages: Message[] };
  return body.messages; // mais recente primeiro
}

/** Quantos e-mails o endereço recebeu. */
export async function countMessages(email: string): Promise<number> {
  return (await search(email)).length;
}

/** Apaga as mensagens do endereço (isola testes que pedem código ao mesmo e-mail). */
export async function clearMessages(email: string): Promise<void> {
  const query = encodeURIComponent(`to:"${email}"`);
  await fetch(`${MAILPIT_URL}/api/v1/search?query=${query}`, { method: "DELETE" });
}

/**
 * Espera um e-mail mais novo que `after` e devolve o código de 6 dígitos.
 * `after` evita pegar o código de um pedido anterior.
 */
export async function waitForCode(
  email: string,
  { after = new Date(0), timeoutMs = 15_000 }: { after?: Date; timeoutMs?: number } = {},
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const latest = (await search(email)).find((m) => new Date(m.Created) > after);
    const code = latest?.Snippet.match(/\b(\d{6})\b/)?.[1];
    if (code) return code;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Nenhum código chegou ao Mailpit para ${email} em ${timeoutMs} ms`);
}
