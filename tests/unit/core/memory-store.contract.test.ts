import { randomUUID } from "node:crypto";
import { MemoryCoreStore, MemoryDb } from "@/data/core/memory/memory-store";
import { describeCoreStoreContract } from "../../contract/core-store.contract";

// 004 · T018 — bateria de contrato contra a implementação em memória (dois donos, um "banco").
describeCoreStoreContract("memória", async () => {
  const db = new MemoryDb();
  return {
    store: new MemoryCoreStore(db, randomUUID()),
    other: new MemoryCoreStore(db, randomUUID()),
  };
});
