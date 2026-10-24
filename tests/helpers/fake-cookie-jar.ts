// 006 — jar de cookies em memória para testes (sem Next).
/** Cookies em memória com o histórico de Set-Cookie (opções incluídas) para o contrato FR-023. */
export class FakeCookieJar {
  values = new Map<string, string>();
  writes: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];

  constructor(initial: Record<string, string> = {}) {
    for (const [name, value] of Object.entries(initial)) this.values.set(name, value);
  }
  get(name: string) {
    return this.values.get(name);
  }
  getAll() {
    return [...this.values].map(([name, value]) => ({ name, value }));
  }
  set(name: string, value: string, options: Record<string, unknown>) {
    this.writes.push({ name, value, options });
    if (options.maxAge === 0) this.values.delete(name);
    else this.values.set(name, value);
  }
  delete(name: string, options: Record<string, unknown>) {
    this.set(name, "", { ...options, maxAge: 0 });
  }
  names() {
    return [...this.values.keys()];
  }
}
