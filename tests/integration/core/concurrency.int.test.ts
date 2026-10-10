import { describe, expect, it } from "vitest";
import { createCoreStore } from "@/data/core";
import { createTestOwner, serviceClient } from "../../helpers/supabase-test";
import { SYNC, USER, incoming, manualAccount, newBatch } from "../../contract/helpers";

// 004 · T073 — sync e edição manual simultâneas (FR-024; edge case "gravação concorrente").
describe("gravação concorrente", () => {
  it("edição manual prevalece nos campos que alterou; fatos da fonte aplicados; ambas auditadas", async () => {
    const owner = (await createTestOwner()).id;
    // dois clientes = duas conexões HTTP/transações independentes
    const syncStore = createCoreStore({ kind: "service", ownerId: owner, client: serviceClient() });
    const userStore = createCoreStore({ kind: "service", ownerId: owner, client: serviceClient() });
    const account = await manualAccount(userStore);
    const first = await newBatch(syncStore, "pluggy");
    const pending = incoming(account.id, {
      source: "pluggy",
      externalId: "P9",
      amountCents: -5000,
      status: "pending",
      descriptionOriginal: "COMPRA PENDENTE",
      merchant: "LOJA FONTE",
    });
    const created = await syncStore.transactions.upsertMany(first.id, [pending], SYNC);
    await syncStore.batches.finish(first.id, "completed", SYNC);
    const id = created.results[0].id!;

    const second = await newBatch(syncStore, "pluggy");
    await Promise.all([
      syncStore.transactions.upsertMany(
        second.id,
        [{ ...pending, amountCents: -5250, status: "posted", merchant: "LOJA FONTE 2" }],
        SYNC,
      ),
      userStore.transactions.update(
        id,
        { merchant: "Loja do bairro", description: "Presente" },
        USER,
      ),
    ]);

    const tx = await userStore.transactions.get(id);
    expect(tx).toMatchObject({
      amountCents: -5250,
      status: "posted",
      merchant: "Loja do bairro",
      description: "Presente",
    });
    expect(tx.lockedFields).toEqual(expect.arrayContaining(["merchant", "description"]));
    const actors = (await userStore.audit.history("transaction", id)).items.map(
      (e) => e.actor.type,
    );
    expect(actors).toEqual(expect.arrayContaining(["sync", "user"]));
  });
});
