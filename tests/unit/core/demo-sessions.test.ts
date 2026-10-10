import { describe, expect, it } from "vitest";
import { DEMO_OWNER_ID } from "@/data/core";
import { DemoSessions } from "@/data/core/memory/demo-sessions";
import { generateDataset } from "@/synthetic/generate";

// 004 · T052 — sessões do modo demonstração (FR-047; contracts/owner-context.md).
const at = (iso: string) => () => new Date(iso);

describe("DemoSessions", () => {
  it("cada sessão tem loja própria do DEMO_OWNER_ID; gravação de uma não aparece na outra", async () => {
    const sessions = new DemoSessions({ now: at("2026-10-08T15:00:00Z") });
    const a = sessions.get("sessao-a");
    const b = sessions.get("sessao-b");
    expect(a).not.toBe(b);
    expect(sessions.get("sessao-a")).toBe(a);
    expect(a.ownerId).toBe(DEMO_OWNER_ID);
    const [account] = await a.accounts.list();
    await a.transactions.createManual(
      { accountId: account.id, amountCents: -123, bookedOn: "2026-10-08", description: "Só na A" },
      { type: "user" },
    );
    const inA = await a.transactions.list({ from: "2026-10-08", to: "2026-10-08" });
    const inB = await b.transactions.list({ from: "2026-10-08", to: "2026-10-08" });
    expect(inA.items.some((t) => t.descriptionOriginal === "Só na A")).toBe(true);
    expect(inB.items.some((t) => t.descriptionOriginal === "Só na A")).toBe(false);
  });

  it("nasce com os dados sintéticos da semente 42 ancorados em hoje (São Paulo)", async () => {
    // 01:00 UTC de 08/10 = 22:00 de 07/10 em São Paulo
    const sessions = new DemoSessions({ now: at("2026-10-08T01:00:00Z") });
    const store = sessions.get("s");
    expect(await store.accounts.list()).toHaveLength(5);
    const ds = generateDataset({ seed: 42, months: 12, anchorDate: "2026-10-07" });
    let total = 0;
    let count = 0;
    let cursor: string | null = null;
    do {
      const page = await store.transactions.list({ limit: 200, cursor });
      for (const t of page.items) total += t.amountCents;
      count += page.items.length;
      cursor = page.nextCursor;
    } while (cursor);
    expect(count).toBe(ds.transactions.length);
    expect(total).toBe(ds.transactions.reduce((s, t) => s + t.amountCents, 0));
    const newest = (await store.transactions.list({ limit: 1 })).items[0];
    expect(newest.bookedOn <= "2026-10-07").toBe(true);
  });

  it("LRU de 50 lojas: a 51ª descarta a menos usada", () => {
    const sessions = new DemoSessions({ now: at("2026-10-08T12:00:00Z"), max: 50 });
    const first = sessions.get("s0");
    for (let i = 1; i < 50; i++) sessions.get(`s${i}`);
    sessions.get("s0"); // s0 vira a mais recente; s1 é a menos usada
    const s1 = sessions.peek("s1");
    sessions.get("s50");
    expect(sessions.size).toBe(50);
    expect(sessions.get("s0")).toBe(first);
    expect(sessions.peek("s1")).toBeUndefined();
    expect(s1).toBeDefined();
  });

  it("TTL de 2 h desde o último uso", () => {
    let now = new Date("2026-10-08T12:00:00Z");
    const sessions = new DemoSessions({ now: () => now });
    const store = sessions.get("s");
    now = new Date("2026-10-08T13:59:00Z");
    expect(sessions.get("s")).toBe(store);
    now = new Date("2026-10-08T16:00:00Z");
    expect(sessions.get("s")).not.toBe(store);
  });
});
