import { randomUUID } from "node:crypto";
import { MemoryAuthStore } from "@/lib/auth/memory-store";
import { defineAuthStoreSuite } from "../../shared/auth-store-suite";

// 006 — contrato da AuthStore na implementação em memória (contratos e modo demonstração).
const store = new MemoryAuthStore();
defineAuthStoreSuite("memória", { store: () => store, newOwner: async () => randomUUID() });
