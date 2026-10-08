// Feature 002 · plan §Governança C5 — espelho revisável dos workflows.
// O Gemini Code Assist não revisa .github/workflows/**; o espelho (fora dessa pasta) leva o
// conteúdo exato de cada workflow para a revisão. Gerado por `npm run review:mirror`.

export interface MirrorEntry {
  path: string;
  content: string;
}

const HEADER = [
  "# Espelho dos workflows (Constitution VIII · feature 002, decisão C5)",
  "",
  "Gerado por `npm run review:mirror`. Não edite à mão: o teste",
  "`tests/unit/review/workflows-mirror.test.ts` exige o conteúdo exato de cada",
  "`.github/workflows/*.yml`. Revisor: avalie estes blocos como se fossem os próprios workflows.",
].join("\n");

const fenceFor = (content: string) => {
  const longest = Math.max(0, ...(content.match(/`+/g) ?? []).map((m) => m.length));
  return "`".repeat(Math.max(4, longest + 1));
};

export function renderWorkflowMirror(entries: MirrorEntry[]): string {
  const blocks = [...entries]
    .sort((a, b) => (a.path < b.path ? -1 : 1))
    .map((e) => {
      const fence = fenceFor(e.content);
      return `## ${e.path}\n\n${fence}yaml\n${e.content}\n${fence}\n`;
    });
  return `${HEADER}\n\n${blocks.join("\n")}`;
}

export function parseWorkflowMirror(markdown: string): MirrorEntry[] {
  const out: MirrorEntry[] = [];
  const re = /^## (\S+)\n\n(`{4,})yaml\n([\s\S]*?)\n\2$/gm;
  for (const m of markdown.matchAll(re)) out.push({ path: m[1], content: m[3] });
  return out;
}
