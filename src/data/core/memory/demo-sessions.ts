import { DEMO_OWNER_ID } from "../constants";
import { MemoryCoreStore, MemoryDb } from "./memory-store";

/** Lojas em memória do modo demonstração, uma por sessão (`prumo_demo_sid`). */
export class DemoSessions {
  private readonly stores = new Map<string, MemoryCoreStore>();

  get(sessionId: string): MemoryCoreStore {
    let store = this.stores.get(sessionId);
    if (!store) {
      store = this.create();
      this.stores.set(sessionId, store);
    }
    return store;
  }

  /** Loja descartável (requisição sem cookie de sessão). */
  ephemeral(): MemoryCoreStore {
    return this.create();
  }

  private create(): MemoryCoreStore {
    return new MemoryCoreStore(new MemoryDb(), DEMO_OWNER_ID);
  }
}

let instance: DemoSessions | undefined;

export function demoSessions(): DemoSessions {
  instance ??= new DemoSessions();
  return instance;
}
