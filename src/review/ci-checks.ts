// Feature 002 · data-model §1.1 — verificações obrigatórias de PR derivadas do ci.yml.
// Recebe o YAML já parseado (o parse fica em scripts/ ou nos testes).

/** Todo job sem `if` é verificação obrigatória de PR; contribui com seu `name`. */
export function requiredChecksFromCi(workflow: unknown): string[] {
  const jobs = (workflow as { jobs?: unknown } | null)?.jobs;
  if (!jobs || typeof jobs !== "object") throw new Error("ci.yml sem jobs");
  const out: string[] = [];
  for (const [id, job] of Object.entries(jobs as Record<string, unknown>)) {
    const j = (job ?? {}) as { name?: unknown; if?: unknown };
    if (j.if !== undefined) continue;
    if (typeof j.name !== "string" || !j.name.trim()) throw new Error(`job sem nome no CI: ${id}`);
    out.push(j.name);
  }
  return out;
}
