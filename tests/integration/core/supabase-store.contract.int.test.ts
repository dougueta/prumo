import { createCoreStore } from "@/data/core";
import { describeCoreStoreContract } from "../../contract/core-store.contract";
import { createTestOwner, serviceClient, userClient } from "../../helpers/supabase-test";

// 004 · T018 — a mesma bateria contra o Supabase, nos modos `user` (JWT, RLS) e `service`.
describeCoreStoreContract("supabase · user", async () => {
  const [a, b] = await Promise.all([createTestOwner(), createTestOwner()]);
  const [clientA, clientB] = await Promise.all([userClient(a), userClient(b)]);
  return {
    store: createCoreStore({ kind: "user", ownerId: a.id, client: clientA }),
    other: createCoreStore({ kind: "user", ownerId: b.id, client: clientB }),
  };
});

describeCoreStoreContract("supabase · service", async () => {
  const [a, b] = await Promise.all([createTestOwner(), createTestOwner()]);
  const client = serviceClient();
  return {
    store: createCoreStore({ kind: "service", ownerId: a.id, client }),
    other: createCoreStore({ kind: "service", ownerId: b.id, client }),
  };
});
