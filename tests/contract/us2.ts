import { describe, expect, it } from "vitest";
import {
  AI,
  expectCoreError,
  importRows,
  incoming,
  manualAccount,
  RULE,
  SYNC,
  USER,
  type StorePair,
} from "./helpers";

/** 004 · T029 — US2: edições manuais nunca são perdidas (FR-024–FR-026). */
export function us2Contract(get: () => StorePair) {
  describe("US2 · proteção de edição manual", () => {
    async function imported(store: StorePair["store"]) {
      const account = await manualAccount(store);
      const { result } = await importRows(
        store,
        [
          incoming(account.id, {
            source: "pluggy",
            externalId: "PJ1",
            descriptionOriginal: "PAG*JOSEDASILVA",
          }),
        ],
        "pluggy",
        SYNC,
      );
      return { account, id: result.results[0].id! };
    }

    it("cenário 1: descrição editada preserva a original e trava o campo", async () => {
      const { store } = get();
      const { id } = await imported(store);
      const tx = await store.transactions.update(id, { description: "Feira do sábado" }, USER);
      expect(tx).toMatchObject({
        description: "Feira do sábado",
        descriptionOriginal: "PAG*JOSEDASILVA",
      });
      expect(tx.lockedFields).toContain("description");
      const ai = await store.transactions.update(id, { description: "Outra coisa" }, AI);
      expect(ai.description).toBe("Feira do sábado");
    });

    it("cenário 2: categoria manual resiste a sync (upsertMany), regra e IA", async () => {
      const { store } = get();
      const { account, id } = await imported(store);
      const tree = await store.categories.tree();
      const food = tree.find((c) => c.templateKey === "food")!;
      const groceries = food.children.find((c) => c.templateKey === "food.groceries")!;
      const restaurants = food.children.find((c) => c.templateKey === "food.restaurants")!;

      await store.transactions.update(id, { category: { id: groceries.id } }, USER);
      const sync = await importRows(
        store,
        [
          incoming(account.id, {
            source: "pluggy",
            externalId: "PJ1",
            descriptionOriginal: "PAG*JOSEDASILVA",
            category: { id: restaurants.id, source: "source" },
          }),
        ],
        "pluggy",
        SYNC,
      );
      expect(sync.result).toMatchObject({ duplicate: 1, protected: 1 });
      expect(sync.result.results[0].protectedFields).toEqual(["categoryId"]);
      expect((await store.batches.get(sync.batch.id)).counts.protected).toBe(1);

      await store.transactions.update(id, { category: { id: restaurants.id } }, RULE);
      await store.transactions.update(id, { category: { id: restaurants.id, confidence: 99 } }, AI);
      const tx = await store.transactions.get(id);
      expect(tx).toMatchObject({
        categoryId: groceries.id,
        categorySource: "manual",
        categoryConfidence: null,
      });
      expect(tx.lockedFields).toContain("categoryId");
    });

    it("cenário 3: categoria da IA (não manual) é atualizável e a auditoria guarda a anterior", async () => {
      const { store } = get();
      const { id } = await imported(store);
      const tree = await store.categories.tree();
      const [a, b] = tree.find((c) => c.templateKey === "leisure")!.children;
      await store.transactions.update(id, { category: { id: a.id, confidence: 60 } }, AI);
      const tx = await store.transactions.update(
        id,
        { category: { id: b.id, confidence: 85 } },
        AI,
      );
      expect(tx).toMatchObject({ categoryId: b.id, categorySource: "ai", categoryConfidence: 85 });
      expect(tx.lockedFields).not.toContain("categoryId");
      const history = await store.audit.history("transaction", id);
      const last = history.items[0];
      expect(last).toMatchObject({ action: "update", actor: { type: "ai" } });
      expect(last.changes.categoryId).toEqual({ old: a.id, new: b.id });
    });

    it("cenário 4: voltar ao automático remove a trava e a IA volta a atualizar", async () => {
      const { store } = get();
      const { id } = await imported(store);
      await store.transactions.update(id, { description: "Minha descrição" }, USER);
      const unlocked = await store.transactions.unlockField(id, "description", USER);
      expect(unlocked.lockedFields).not.toContain("description");
      const ai = await store.transactions.update(id, { description: "Descrição da IA" }, AI);
      expect(ai.description).toBe("Descrição da IA");
      const history = await store.audit.history("transaction", id);
      expect(history.items.map((e) => e.action)).toContain("unlock");
      await expectCoreError(
        store.transactions.unlockField(id, "inexistente" as never, USER),
        "validation",
      );
    });

    it('"Sem categoria" escolhida manualmente fica protegida contra a IA', async () => {
      const { store } = get();
      const { id } = await imported(store);
      const uncategorized = await store.categories.bySystemKey("uncategorized");
      const tx = await store.transactions.update(id, { category: { id: uncategorized.id } }, USER);
      expect(tx.categoryId).toBeNull();
      expect(tx.lockedFields).toContain("categoryId");
      const leisure = (await store.categories.tree()).find((c) => c.templateKey === "leisure")!;
      const ai = await store.transactions.update(
        id,
        { category: { id: leisure.id, confidence: 90 } },
        AI,
      );
      expect(ai.categoryId).toBeNull();
    });

    it("valor/data de importada não se editam pelo usuário (imported_fact)", async () => {
      const { store } = get();
      const { id } = await imported(store);
      await expectCoreError(
        store.transactions.update(id, { amountCents: -1 }, USER),
        "forbidden_operation",
        {
          reason: "imported_fact",
        },
      );
      await expectCoreError(
        store.transactions.update(id, { bookedOn: "2026-01-01" }, USER),
        "forbidden_operation",
        { reason: "imported_fact" },
      );
      expect((await store.transactions.get(id)).amountCents).toBe(-800);
    });

    it("regravação pela fonte não sobrescreve descrição/estabelecimento travados", async () => {
      const { store } = get();
      const { account, id } = await imported(store);
      await store.transactions.update(id, { merchant: "Feira Livre" }, USER);
      const again = await importRows(
        store,
        [
          incoming(account.id, {
            source: "pluggy",
            externalId: "PJ1",
            descriptionOriginal: "PAG*JOSEDASILVA",
            merchant: "JOSE DA SILVA ME",
          }),
        ],
        "pluggy",
        SYNC,
      );
      expect(again.result.results[0].protectedFields).toEqual(["merchant"]);
      expect((await store.transactions.get(id)).merchant).toBe("Feira Livre");
      // atores automáticos não destravam campos
      await store.transactions.update(id, { notes: "nota da regra" }, RULE);
      expect((await store.transactions.get(id)).lockedFields).toContain("merchant");
    });

    it("posted → pending é proibido para qualquer ator", async () => {
      const { store } = get();
      const account = await manualAccount(store);
      const manual = await store.transactions.createManual(
        { accountId: account.id, amountCents: -100, bookedOn: "2026-09-01", description: "Café" },
        USER,
      );
      await expectCoreError(
        store.transactions.update(manual.id, { status: "pending" }, USER),
        "forbidden_operation",
        {
          reason: "status_regression",
        },
      );
    });
  });
}
