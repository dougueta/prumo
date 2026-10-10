import { describe, expect, it } from "vitest";
import {
  CATALOG_OTHER,
  expectCoreError,
  importRows,
  incoming,
  manualAccount,
  MISSING_ID,
  SYNC,
  USER,
  type StorePair,
} from "./helpers";

const MERCADO_PAGO = "00000000-0000-4000-a000-000000000323";

/** 004 · T040–T042 — US4: cadastro e manutenção manual (FR-005–FR-012, FR-016–FR-019, FR-023,
 * FR-024, FR-027–FR-032, FR-037, FR-038, FR-043). */
export function us4Contract(get: () => StorePair) {
  describe("US4 · contas e instituições (T040)", () => {
    it("cria cartão manual com limite, fechamento e vencimento", async () => {
      const { store } = get();
      const card = await manualAccount(store, {
        name: "Cartão Caixa",
        type: "credit_card",
        creditLimitCents: 500_000,
        closingDay: 5,
        dueDay: 12,
        nickname: "Caixinha",
        last4: "1234",
      });
      expect(card).toMatchObject({
        name: "Cartão Caixa",
        type: "credit_card",
        source: "manual",
        currency: "BRL",
        creditLimitCents: 500_000,
        closingDay: 5,
        dueDay: 12,
        archivedAt: null,
      });
      expect(await store.accounts.list()).toHaveLength(1);
    });

    it("campos de cartão em outro tipo e moeda ≠ BRL são recusados", async () => {
      const { store } = get();
      await expectCoreError(manualAccount(store, { type: "checking", dueDay: 10 }), "validation");
      await expectCoreError(manualAccount(store, { currency: "USD" } as never), "validation");
      const checking = await manualAccount(store);
      await expectCoreError(store.accounts.update(checking.id, { dueDay: 10 }, USER), "validation");
      await expectCoreError(manualAccount(store, { institutionId: MISSING_ID }), "not_found");
    });

    it("upsert pluggy é idempotente por (source, externalId) e respeita a partição de campos", async () => {
      const { store } = get();
      const input = {
        institutionId: CATALOG_OTHER,
        name: "Cartão C6 (simulado)",
        type: "credit_card" as const,
        source: "pluggy" as const,
        externalId: "pluggy-acc-1",
        creditLimitCents: 100_000,
      };
      const first = await store.accounts.upsert(input, SYNC);
      // o dono define campos dele
      await store.accounts.update(first.id, { nickname: "Roxo", closingDay: 3, dueDay: 12 }, USER);
      // sincronização traz outros valores para tudo
      const synced = await store.accounts.upsert(
        {
          ...input,
          name: "Cartão C6 Black (simulado)",
          creditLimitCents: 200_000,
          dueDay: 15,
          nickname: "X",
        },
        SYNC,
      );
      expect(synced.id).toBe(first.id);
      expect(synced).toMatchObject({
        name: "Cartão C6 Black (simulado)",
        creditLimitCents: 200_000,
        nickname: "Roxo",
        closingDay: 3,
        dueDay: 12,
      });
      expect(await store.accounts.list()).toHaveLength(1);
      // usuário não edita campo da fonte em conta conectada
      await expectCoreError(
        store.accounts.update(first.id, { name: "Meu nome" }, USER),
        "forbidden_operation",
        {
          reason: "source_field",
        },
      );
      await expectCoreError(
        store.accounts.update(first.id, { creditLimitCents: 1 }, USER),
        "forbidden_operation",
        { reason: "source_field" },
      );
      // saldo informado pela fonte
      const reported = await store.accounts.setReportedBalance(
        first.id,
        -45_000,
        "2026-09-30",
        SYNC,
      );
      expect(reported).toMatchObject({
        reportedBalanceCents: -45_000,
        reportedBalanceOn: "2026-09-30",
      });
    });

    it("saldo inicial só em conta manual", async () => {
      const { store } = get();
      await expectCoreError(
        store.accounts.upsert(
          {
            institutionId: CATALOG_OTHER,
            name: "X",
            type: "checking",
            source: "pluggy",
            externalId: "e1",
            openingBalanceCents: 100,
          },
          SYNC,
        ),
        "validation",
      );
    });

    it("arquivar e desarquivar mantém histórico e consultas", async () => {
      const { store } = get();
      const account = await manualAccount(store);
      const { result } = await importRows(store, [incoming(account.id)]);
      const archived = await store.accounts.setArchived(account.id, true, USER);
      expect(archived.archivedAt).not.toBeNull();
      expect(await store.accounts.list()).toEqual([]);
      expect(await store.accounts.list({ includeArchived: true })).toHaveLength(1);
      expect((await store.transactions.get(result.results[0].id!)).accountId).toBe(account.id);
      const history = await store.audit.history("account", account.id);
      expect(history.items[0].action).toBe("archive");
      const back = await store.accounts.setArchived(account.id, false, USER);
      expect(back.archivedAt).toBeNull();
      expect((await store.audit.history("account", account.id)).items[0].action).toBe("unarchive");
    });

    it("balances: calculado, informado e divergência", async () => {
      const { store } = get();
      const account = await manualAccount(store, {
        openingBalanceCents: 10_000,
        openingBalanceOn: "2026-09-01",
      });
      await store.transactions.createManual(
        {
          accountId: account.id,
          amountCents: -2_500,
          bookedOn: "2026-09-05",
          description: "Feira",
        },
        USER,
      );
      await store.transactions.createManual(
        {
          accountId: account.id,
          amountCents: -999,
          bookedOn: "2026-09-06",
          description: "Pendente",
          status: "pending",
        },
        USER,
      );
      await store.accounts.setReportedBalance(account.id, 7_000, "2026-09-05", USER);
      const [balance] = await store.accounts.balances("2026-09-30");
      expect(balance).toEqual({
        accountId: account.id,
        reportedCents: 7_000,
        reportedOn: "2026-09-05",
        computedCents: 7_500,
        computedAtReportedCents: 7_500,
        divergenceCents: -500,
      });
    });

    it("instituições: catálogo + próprias; catálogo não é editável", async () => {
      const { store } = get();
      const list = await store.institutions.list();
      expect(list.filter((i) => i.ownerId === null)).toHaveLength(11);
      expect(list.map((i) => i.name)).toEqual(
        expect.arrayContaining(["Mercado Pago", "PicPay", "C6 Bank"]),
      );
      const own = await store.institutions.create(
        { name: "Cooperativa Fictícia", kind: "bank", bankCode: "756" },
        USER,
      );
      expect(own).toMatchObject({ ownerId: store.ownerId, bankCode: "756" });
      const renamed = await store.institutions.update(
        own.id,
        { name: "Cooperativa Fictícia Sul" },
        USER,
      );
      expect(renamed.name).toBe("Cooperativa Fictícia Sul");
      await expectCoreError(
        store.institutions.update(MERCADO_PAGO, { name: "Hackeado" }, USER),
        "not_found",
      );
      await expectCoreError(
        store.institutions.create({ name: "cooperativa ficticia sul", kind: "bank" }, USER),
        "conflict",
      );
      const account = await manualAccount(store, { institutionId: own.id });
      expect(account.institutionId).toBe(own.id);
    });
  });

  describe("US4 · transações manuais (T041)", () => {
    it("criar, editar valor/data/conta, excluir e restaurar", async () => {
      const { store } = get();
      const a = await manualAccount(store);
      const b = await manualAccount(store, { name: "Carteira (simulada)", type: "digital_wallet" });
      const tx = await store.transactions.createManual(
        {
          accountId: a.id,
          amountCents: -1_500,
          bookedOn: "2026-09-01",
          description: "Feira",
          notes: "em dinheiro",
        },
        USER,
      );
      expect(tx).toMatchObject({
        source: "manual",
        batchId: null,
        status: "posted",
        descriptionOriginal: "Feira",
        identityKey: `man:${tx.id}`,
      });
      const edited = await store.transactions.update(
        tx.id,
        { amountCents: -1_600, bookedOn: "2026-09-02", accountId: b.id },
        USER,
      );
      expect(edited).toMatchObject({
        amountCents: -1_600,
        bookedOn: "2026-09-02",
        accountId: b.id,
      });
      const history = await store.audit.history("transaction", tx.id);
      expect(history.items[0].changes.amountCents).toEqual({ old: -1_500, new: -1_600 });

      expect(await store.transactions.softDelete([tx.id], "user", USER)).toBe(1);
      expect((await store.transactions.list({})).items).toEqual([]);
      const deleted = await store.transactions.get(tx.id, { includeDeleted: true });
      expect(deleted).toMatchObject({ deletedReason: "user" });
      expect((await store.audit.history("transaction", tx.id)).items[0]).toMatchObject({
        action: "soft_delete",
        reason: "user",
      });
      await expectCoreError(
        store.transactions.update(tx.id, { notes: "x" }, USER),
        "forbidden_operation",
        {
          reason: "deleted",
        },
      );

      expect(await store.transactions.restore([tx.id], USER)).toBe(1);
      const restored = await store.transactions.get(tx.id);
      expect(restored).toMatchObject({
        amountCents: -1_600,
        status: "posted",
        deletedAt: null,
        deletedReason: null,
      });
      expect((await store.audit.history("transaction", tx.id)).items[0].action).toBe("restore");
    });

    it("pendente manual restaurada volta como pendente", async () => {
      const { store } = get();
      const a = await manualAccount(store);
      const tx = await store.transactions.createManual(
        {
          accountId: a.id,
          amountCents: -10,
          bookedOn: "2026-09-01",
          description: "P",
          status: "pending",
        },
        USER,
      );
      await store.transactions.softDelete([tx.id], "user", USER);
      await store.transactions.restore([tx.id], USER);
      expect((await store.transactions.get(tx.id)).status).toBe("pending");
    });

    it("natureza + vínculo; excluir a contrapartida desfaz o vínculo (natureza volta a regular, auditado)", async () => {
      const { store } = get();
      await store.bootstrap();
      const a = await manualAccount(store);
      const b = await manualAccount(store, { name: "Conta Horizonte (simulada)" });
      const out = await store.transactions.createManual(
        {
          accountId: a.id,
          amountCents: -30_000,
          bookedOn: "2026-09-06",
          description: "Transferência",
          nature: "internal_transfer",
        },
        USER,
      );
      const income = await store.transactions.createManual(
        {
          accountId: b.id,
          amountCents: 30_000,
          bookedOn: "2026-09-06",
          description: "Transferência",
          nature: "internal_transfer",
          relatedTransactionId: out.id,
        },
        USER,
      );
      const transfer = await store.categories.bySystemKey("internal_transfer");
      expect(income).toMatchObject({ relatedTransactionId: out.id, categoryId: transfer.id });
      await store.transactions.softDelete([out.id], "user", USER);
      const after = await store.transactions.get(income.id);
      expect(after).toMatchObject({ relatedTransactionId: null, nature: "regular" });
      const last = (await store.audit.history("transaction", income.id)).items[0];
      expect(last.changes).toMatchObject({
        relatedTransactionId: { old: out.id, new: null },
        nature: { old: "internal_transfer", new: "regular" },
      });
      // vincular a uma excluída é recusado
      await expectCoreError(
        store.transactions.update(income.id, { relatedTransactionId: out.id }, USER),
        "validation",
        { field: "relatedTransactionId" },
      );
    });

    it("mesclar: softDelete(merged, mergedInto) e restaurar com sobrevivente excluído é proibido", async () => {
      const { store } = get();
      const a = await manualAccount(store);
      const make = (d: string) =>
        store.transactions.createManual(
          { accountId: a.id, amountCents: -500, bookedOn: "2026-09-10", description: d },
          USER,
        );
      const survivor = await make("Sobrevivente");
      const dup = await make("Duplicada");
      await expectCoreError(store.transactions.softDelete([dup.id], "merged", USER), "validation");
      expect(await store.transactions.softDelete([dup.id], "merged", USER, survivor.id)).toBe(1);
      expect(await store.transactions.get(dup.id, { includeDeleted: true })).toMatchObject({
        deletedReason: "merged",
        mergedIntoId: survivor.id,
      });
      expect((await store.audit.history("transaction", dup.id)).items[0].action).toBe("merge");
      await store.transactions.softDelete([survivor.id], "user", USER);
      await expectCoreError(store.transactions.restore([dup.id], USER), "forbidden_operation", {
        reason: "merged_survivor_deleted",
      });
      expect(await store.transactions.restore([survivor.id, dup.id], USER)).toBe(2);
    });

    it("convenção de sinal em cartão: compra negativa, pagamento positivo", async () => {
      const { store } = get();
      const card = await manualAccount(store, {
        type: "credit_card",
        name: "Cartão Órbita (simulado)",
      });
      const buy = await store.transactions.createManual(
        { accountId: card.id, amountCents: -12_000, bookedOn: "2026-09-02", description: "Compra" },
        USER,
      );
      const pay = await store.transactions.createManual(
        {
          accountId: card.id,
          amountCents: 12_000,
          bookedOn: "2026-09-10",
          description: "Pagamento",
          nature: "card_payment",
        },
        USER,
      );
      expect(buy.amountCents).toBeLessThan(0);
      expect(pay.amountCents).toBeGreaterThan(0);
      expect((await store.accounts.balances("2026-09-30"))[0].computedCents).toBe(0);
    });

    it("softDelete com id inexistente não altera nada", async () => {
      const { store } = get();
      const a = await manualAccount(store);
      const tx = await store.transactions.createManual(
        { accountId: a.id, amountCents: -1, bookedOn: "2026-09-01", description: "x" },
        USER,
      );
      await expectCoreError(
        store.transactions.softDelete([tx.id, MISSING_ID], "user", USER),
        "not_found",
      );
      expect((await store.transactions.get(tx.id)).deletedAt).toBeNull();
    });
  });

  describe("US4 · categorias (T042)", () => {
    async function byTemplate(store: StorePair["store"], key: string) {
      const all = (await store.categories.tree({ includeHidden: true })).flatMap((n) => [
        n,
        ...n.children,
      ]);
      return all.find((c) => c.templateKey === key)!;
    }

    it("árvore de 2 níveis, herança de tipo e nome único sem acento/caixa", async () => {
      const { store } = get();
      const food = await byTemplate(store, "food");
      const sub = await store.categories.create(
        { name: "Feira", parentId: food.id, kind: "income" },
        USER,
      );
      expect(sub).toMatchObject({ parentId: food.id, kind: "expense", origin: "custom" });
      await expectCoreError(
        store.categories.create({ name: "FÉIRA ", parentId: food.id }, USER),
        "conflict",
      );
      // mesmo nome em outro pai é permitido
      const leisure = await byTemplate(store, "leisure");
      await store.categories.create({ name: "Feira", parentId: leisure.id }, USER);
      // 3º nível é proibido
      await expectCoreError(
        store.categories.create({ name: "Neta", parentId: sub.id }, USER),
        "forbidden_operation",
        {
          reason: "depth",
        },
      );
      // categoria com filhos não ganha pai
      await expectCoreError(
        store.categories.update(food.id, { parentId: leisure.id }, USER),
        "forbidden_operation",
        {
          reason: "depth",
        },
      );
      // mudar o tipo do pai propaga aos filhos
      const top = await store.categories.create({ name: "Projetos", kind: "expense" }, USER);
      const child = await store.categories.create(
        { name: "Reforma do apê", parentId: top.id },
        USER,
      );
      await store.categories.update(top.id, { kind: "neutral" }, USER);
      const tree = await store.categories.tree();
      expect(tree.find((n) => n.id === top.id)!.children.find((c) => c.id === child.id)!.kind).toBe(
        "neutral",
      );
    });

    it("renomear reflete nas transações; ocultar e mover", async () => {
      const { store } = get();
      const food = await byTemplate(store, "food");
      const a = await manualAccount(store);
      const tx = await store.transactions.createManual(
        {
          accountId: a.id,
          amountCents: -100,
          bookedOn: "2026-09-01",
          description: "x",
          categoryId: food.id,
        },
        USER,
      );
      const renamed = await store.categories.update(food.id, { name: "Comida" }, USER);
      expect(renamed.name).toBe("Comida");
      expect((await store.transactions.get(tx.id)).categoryId).toBe(food.id);
      const hidden = await store.categories.update(food.id, { hidden: true }, USER);
      expect(hidden.hidden).toBe(true);
      expect((await store.categories.tree()).some((n) => n.id === food.id)).toBe(false);
      expect(
        (await store.categories.tree({ includeHidden: true })).some((n) => n.id === food.id),
      ).toBe(true);
      const games = await byTemplate(store, "leisure.games");
      const shopping = await byTemplate(store, "shopping");
      const moved = await store.categories.update(games.id, { parentId: shopping.id }, USER);
      expect(moved.parentId).toBe(shopping.id);
      const toTop = await store.categories.update(games.id, { parentId: null }, USER);
      expect(toTop.parentId).toBeNull();
    });

    it("categorias de sistema: renomeáveis, nunca excluídas nem movidas", async () => {
      const { store } = get();
      const transfer = await store.categories.bySystemKey("internal_transfer");
      const renamed = await store.categories.update(
        transfer.id,
        { name: "Entre minhas contas" },
        USER,
      );
      expect(renamed.name).toBe("Entre minhas contas");
      await expectCoreError(
        store.categories.remove(transfer.id, { children: "move" }, USER),
        "forbidden_operation",
        {
          reason: "system_category",
        },
      );
      const fees = await store.categories.bySystemKey("bank_fees");
      const leisure = await byTemplate(store, "leisure");
      await expectCoreError(
        store.categories.update(fees.id, { parentId: leisure.id }, USER),
        "forbidden_operation",
        {
          reason: "system_category",
        },
      );
      const taxes = await byTemplate(store, "taxes_fees");
      await expectCoreError(
        store.categories.remove(taxes.id, { children: "move" }, USER),
        "forbidden_operation",
        {
          reason: "system_child",
        },
      );
    });

    it("excluir com destino padrão (Sem categoria ⇒ null) e auditoria reassign", async () => {
      const { store } = get();
      const leisure = await byTemplate(store, "leisure");
      const a = await manualAccount(store);
      const ids = [];
      for (let i = 0; i < 3; i++) {
        ids.push(
          (
            await store.transactions.createManual(
              {
                accountId: a.id,
                amountCents: -100 - i,
                bookedOn: "2026-09-01",
                description: `L${i}`,
                categoryId: leisure.id,
              },
              USER,
            )
          ).id,
        );
      }
      expect(await store.categories.remove(leisure.id, { children: "move" }, USER)).toEqual({
        reassigned: 3,
      });
      for (const id of ids) {
        expect(await store.transactions.get(id)).toMatchObject({
          categoryId: null,
          categorySource: null,
        });
        expect((await store.audit.history("transaction", id)).items[0].action).toBe("reassign");
      }
      const tree = await store.categories.tree({ includeDeleted: true });
      expect(tree.find((n) => n.id === leisure.id)!.deletedAt).not.toBeNull();
      // filhos movidos para o 1º nível (destino "Sem categoria")
      expect(tree.some((n) => n.templateKey === "leisure.games" && n.parentId === null)).toBe(true);
    });

    it("excluir com destino e filhos excluídos junto; restaurar revalida o nome", async () => {
      const { store } = get();
      const travel = await byTemplate(store, "travel");
      const tickets = await byTemplate(store, "travel.tickets");
      const shopping = await byTemplate(store, "shopping");
      const a = await manualAccount(store);
      const tx = await store.transactions.createManual(
        {
          accountId: a.id,
          amountCents: -900,
          bookedOn: "2026-09-01",
          description: "Passagem",
          categoryId: tickets.id,
        },
        USER,
      );
      await expectCoreError(
        store.categories.remove(travel.id, { targetId: tickets.id, children: "delete" }, USER),
        "validation",
      );
      expect(
        await store.categories.remove(
          travel.id,
          { targetId: shopping.id, children: "delete" },
          USER,
        ),
      ).toEqual({
        reassigned: 1,
      });
      expect((await store.transactions.get(tx.id)).categoryId).toBe(shopping.id);
      const all = (await store.categories.tree({ includeDeleted: true })).flatMap((n) => [
        n,
        ...n.children,
      ]);
      expect(all.find((c) => c.id === tickets.id)!.deletedAt).not.toBeNull();
      // restaurar reativa sem desfazer a reatribuição
      const restored = await store.categories.restore(travel.id, USER);
      expect(restored.deletedAt).toBeNull();
      expect((await store.transactions.get(tx.id)).categoryId).toBe(shopping.id);
      // nome ocupado por outra irmã ⇒ conflict
      const extra = await store.categories.create({ name: "Lazer extra", kind: "expense" }, USER);
      await store.categories.remove(extra.id, { children: "move" }, USER);
      await store.categories.create({ name: "lazer EXTRA", kind: "expense" }, USER);
      await expectCoreError(store.categories.restore(extra.id, USER), "conflict");
    });
  });
}
