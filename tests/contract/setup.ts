import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll } from "vitest";

process.env.TZ = "America/Sao_Paulo";

/**
 * Servidor MSW compartilhado pelos testes de contrato (006). Cada teste registra os handlers do
 * Supabase Auth simulado com `server.use(...)`; qualquer requisição sem handler falha o teste —
 * o projeto `contract` nunca acessa a rede.
 */
export const server = setupServer();

// MSW 3: a opção é `onUnhandledFrame` (a antiga `onUnhandledRequest` é ignorada sem aviso).
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
