import type { AuthCookieOptions } from "./cookie-options";

/**
 * Cookies do pedido atual, independente do Next (testável). Adaptadores: `nextCookieJar()`
 * (Server Actions e Route Handlers) e o jar falso dos testes de contrato.
 */
export type CookieJar = {
  get(name: string): string | undefined;
  getAll(): Array<{ name: string; value: string }>;
  set(name: string, value: string, options: AuthCookieOptions): void;
};

/** `cookies()` do Next. Em Server Component a gravação lança — ali só se lê. */
export async function nextCookieJar(): Promise<CookieJar> {
  const { cookies } = await import("next/headers");
  const store = await cookies();
  return {
    get: (name) => store.get(name)?.value,
    getAll: () => store.getAll().map(({ name, value }) => ({ name, value })),
    set: (name, value, options) => {
      try {
        store.set(name, value, options);
      } catch {
        // Server Component: cookies só leitura (Next 16). Quem precisa gravar usa /auth/sair.
      }
    },
  };
}
