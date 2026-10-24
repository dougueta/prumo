import { todayInSaoPaulo } from "@/domain/core/dates";
import { generateDataset } from "@/synthetic/generate";
import { DEMO_OWNER_ID } from "../constants";
import { fromSyntheticDataset } from "../synthetic-adapter";
import { MemoryCoreStore, MemoryDb } from "./memory-store";

/**
 * Lojas em memória do modo demonstração, uma por sessão (`prumo_demo_sid`): até 50 por instância
 * (LRU) e TTL de 2 h desde o último uso. Cada loja nasce dos dados sintéticos da semente 42
 * ancorados em "hoje" (São Paulo). Gravações valem só na sessão/instância (ADR 0006, FR-047).
 */
export type DemoSessionsOptions = { now?: () => Date; max?: number; ttlMs?: number };

const TWO_HOURS = 2 * 60 * 60 * 1000;

export class DemoSessions {
  private readonly stores = new Map<string, { store: MemoryCoreStore; lastUsed: number }>();
  private readonly now: () => Date;
  private readonly max: number;
  private readonly ttlMs: number;

  constructor(options: DemoSessionsOptions = {}) {
    this.now = options.now ?? (() => new Date());
    this.max = options.max ?? 50;
    this.ttlMs = options.ttlMs ?? TWO_HOURS;
  }

  get size(): number {
    return this.stores.size;
  }

  /** Loja da sessão, sem criar nem renovar (diagnóstico/testes). */
  peek(sessionId: string): MemoryCoreStore | undefined {
    return this.stores.get(sessionId)?.store;
  }

  get(sessionId: string): MemoryCoreStore {
    const now = this.now().getTime();
    this.evictExpired(now);
    const entry = this.stores.get(sessionId);
    if (entry) {
      // reinsere para manter a ordem de uso (Map preserva inserção ⇒ LRU)
      this.stores.delete(sessionId);
      this.stores.set(sessionId, { store: entry.store, lastUsed: now });
      return entry.store;
    }
    const store = this.create();
    this.stores.set(sessionId, { store, lastUsed: now });
    while (this.stores.size > this.max) {
      const oldest = this.stores.keys().next().value as string;
      this.stores.delete(oldest);
    }
    return store;
  }

  /** Loja descartável (requisição sem cookie de sessão). */
  ephemeral(): MemoryCoreStore {
    return this.create();
  }

  private evictExpired(now: number): void {
    for (const [id, entry] of this.stores) {
      if (now - entry.lastUsed > this.ttlMs) this.stores.delete(id);
    }
  }

  private create(): MemoryCoreStore {
    const anchorDate = todayInSaoPaulo(this.now);
    const store = new MemoryCoreStore(new MemoryDb(this.now), DEMO_OWNER_ID);
    store.loadSynthetic(
      fromSyntheticDataset(generateDataset({ seed: 42, months: 12, anchorDate }), DEMO_OWNER_ID),
    );
    return store;
  }
}

let instance: DemoSessions | undefined;

export function demoSessions(): DemoSessions {
  instance ??= new DemoSessions();
  return instance;
}
