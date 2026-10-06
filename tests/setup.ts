// Setup comum de testes (unit e integração).
process.env.TZ = "America/Sao_Paulo";

// FR-008: nenhum teste chama serviços externos reais. Só hosts locais (Supabase local/CI).
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "host.docker.internal"]);
const realFetch = globalThis.fetch;

globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (!LOCAL_HOSTS.has(url.hostname)) {
    return Promise.reject(new Error(`Rede externa bloqueada nos testes: ${url.hostname}`));
  }
  return realFetch(input, init);
};
