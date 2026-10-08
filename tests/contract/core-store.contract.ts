import { beforeEach, describe, expect, it } from "vitest";
import type { StorePair } from "./helpers";
import { us1Contract } from "./us1";

export type { StorePair } from "./helpers";

/**
 * 004 · T018 — bateria ÚNICA de contrato do CoreStore (FR-045, FR-046, SC-005). Roda contra a
 * memória (tests/unit/core/memory-store.contract.test.ts) e contra o Supabase
 * (tests/integration/core/supabase-store.contract.int.test.ts, modos user e service).
 * Cada caso recebe dois donos novos: `store` (A) e `other` (B). Só dados sintéticos.
 * Os casos por história ficam em ./usN.ts e são compostos aqui.
 */
export function describeCoreStoreContract(name: string, makeStore: () => Promise<StorePair>) {
  describe(`CoreStore (${name})`, () => {
    let pair: StorePair;
    const get = () => pair;

    beforeEach(async () => {
      pair = await makeStore();
    });

    it("cada loja pertence a um dono distinto", () => {
      expect(pair.store.ownerId).not.toBe(pair.other.ownerId);
    });

    describe("bootstrap (FR-029)", () => {
      it("é idempotente: cria 99 categorias e, na 2ª chamada, 0", async () => {
        const { store } = get();
        expect(await store.bootstrap()).toEqual({ createdCategories: 99 });
        expect(await store.bootstrap()).toEqual({ createdCategories: 0 });
      });

      it("categories.tree() vazio dispara o bootstrap preguiçoso", async () => {
        const { store } = get();
        const tree = await store.categories.tree({ includeHidden: true });
        expect(tree).toHaveLength(24);
        expect(tree.reduce((n, node) => n + node.children.length, 0)).toBe(75);
        expect(await store.bootstrap()).toEqual({ createdCategories: 0 });
        const uncategorized = await store.categories.bySystemKey("uncategorized");
        expect(uncategorized).toMatchObject({ name: "Sem categoria", origin: "system" });
      });

      it("não afeta o outro dono", async () => {
        const { store, other } = get();
        await store.bootstrap();
        expect(await other.bootstrap()).toEqual({ createdCategories: 99 });
      });
    });

    us1Contract(get);
  });
}
