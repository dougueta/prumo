// fetch falso para os testes de contrato (nenhuma chamada de rede).
export interface FakeResponse {
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
}
export type Route = FakeResponse | FakeResponse[] | ((req: RecordedCall) => FakeResponse);
export interface RecordedCall {
  method: string;
  url: string;
  path: string;
  query: string;
  headers: Record<string, string>;
  body: unknown;
}

/**
 * Rotas por "MÉTODO /caminho" ou "MÉTODO /caminho?query" (exato). Lista = respostas em sequência
 * (a última se repete). Rota inexistente responde 599 para o teste falhar de forma visível.
 */
export function createFakeFetch(routes: Record<string, Route>) {
  const calls: RecordedCall[] = [];
  const counters = new Map<string, number>();
  const fetchImpl = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const method = (init.method ?? "GET").toUpperCase();
    const headers: Record<string, string> = {};
    new Headers(init.headers).forEach((v, k) => (headers[k.toLowerCase()] = v));
    const call: RecordedCall = {
      method,
      url: url.toString(),
      path: url.pathname,
      query: url.search,
      headers,
      body: init.body ? JSON.parse(String(init.body)) : undefined,
    };
    calls.push(call);
    const key = [`${method} ${url.pathname}${url.search}`, `${method} ${url.pathname}`].find(
      (k) => k in routes,
    );
    if (!key)
      return new Response(JSON.stringify({ message: `rota não simulada: ${method} ${url}` }), {
        status: 599,
      });
    const route = routes[key];
    let res: FakeResponse;
    if (typeof route === "function") res = route(call);
    else if (Array.isArray(route)) {
      const i = counters.get(key) ?? 0;
      counters.set(key, i + 1);
      res = route[Math.min(i, route.length - 1)];
    } else res = route;
    const status = res.status ?? 200;
    const body = status === 204 ? null : JSON.stringify(res.body ?? {});
    return new Response(body, {
      status,
      headers: { "content-type": "application/json", ...res.headers },
    });
  };
  return { fetch: fetchImpl as typeof fetch, calls };
}

export const API = "https://api.github.com";
export const R = "/repos/dougueta/prumo";
