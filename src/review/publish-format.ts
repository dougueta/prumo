// Feature 002 · contracts/review-cli.md §review:publish — comentário final do prumo-revisor.
// O marcador `head=` e a seção "Insumos lidos" vêm do manifest do pacote, nunca do revisor.
import type { Manifest } from "./bundle";
import { parseVerdict } from "./parse-verdict";

export type Publication = { ok: true; body: string } | { ok: false; exit: 2 | 4; errors: string[] };

export const HEAD_CHANGED = "PR recebeu commits após o pacote — refaça /revisar-pr";

function stripInputsSection(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  let skipping = false;
  for (const line of lines) {
    if (/^###\s+Insumos lidos\s*$/i.test(line)) {
      skipping = true;
      continue;
    }
    if (skipping && /^#{2,3}\s/.test(line)) skipping = false;
    if (!skipping) out.push(line);
  }
  return out.join("\n");
}

export function formatPublication(input: {
  verdictText: string;
  manifest: Manifest;
  currentHead: string;
}): Publication {
  const text = stripInputsSection(
    input.verdictText.replace(/\r\n/g, "\n").replace(/^<!-- prumo:veredito v1[^\n]*-->\s*$/gm, ""),
  ).trim();
  const inputs = input.manifest.files.map((f) =>
    f.sha256 === "ausente" ? `- ${f.path} (ausente)` : `- ${f.path} (sha256: ${f.sha256})`,
  );
  const body = [
    `<!-- prumo:veredito v1 head=${input.manifest.headSha} -->`,
    text,
    "",
    "### Insumos lidos",
    ...inputs,
  ].join("\n");
  const parsed = parseVerdict(body, "claude");
  if (parsed.status !== "ok") {
    return {
      ok: false,
      exit: 2,
      errors: [parsed.status === "invalid" ? parsed.error : "sem veredito"],
    };
  }
  if (input.currentHead !== input.manifest.headSha) {
    return { ok: false, exit: 4, errors: [HEAD_CHANGED] };
  }
  return { ok: true, body };
}
