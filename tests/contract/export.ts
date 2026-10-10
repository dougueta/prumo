import { describe, expect, it } from "vitest";
import type { ExportChunk } from "@/data/core";
import { importRows, incoming, manualAccount, USER, type StorePair } from "./helpers";

const ORDER = [
  "institutions",
  "accounts",
  "categories",
  "import_batches",
  "transactions",
  "audit_log",
];

/** 004 · T075 — exportAll (FR-044). */
export function exportContract(get: () => StorePair) {
  describe("exportAll (FR-044)", () => {
    it("tudo do dono, inclusive excluídos, arquivados e auditoria; nada do outro dono; chunks ≤ 500 em ordem", async () => {
      const { store, other } = get();
      await store.bootstrap();
      await store.institutions.create({ name: "Banco Próprio Fictício", kind: "bank" }, USER);
      const account = await manualAccount(store);
      const archived = await manualAccount(store, { name: "Conta antiga (simulada)" });
      await store.accounts.setArchived(archived.id, true, USER);
      const rows = Array.from({ length: 12 }, (_, i) =>
        incoming(account.id, { descriptionOriginal: `EXP ${i}`, amountCents: -(i + 1) }),
      );
      const { result } = await importRows(store, rows);
      await store.transactions.softDelete([result.results[0].id!], "user", USER);
      const otherAccount = await manualAccount(other);
      await importRows(other, [incoming(otherAccount.id)]);

      const chunks: ExportChunk[] = [];
      for await (const chunk of store.exportAll()) chunks.push(chunk);
      const entities = chunks.map((c) => c.entity);
      expect(entities.map((e) => ORDER.indexOf(e))).toEqual(
        [...entities.map((e) => ORDER.indexOf(e))].sort((a, b) => a - b),
      );
      for (const chunk of chunks) expect(chunk.rows.length).toBeLessThanOrEqual(500);
      const all = <E extends ExportChunk["entity"]>(entity: E) =>
        chunks.filter((c) => c.entity === entity).flatMap((c) => c.rows as unknown[]) as Extract<
          ExportChunk,
          { entity: E }
        >["rows"];

      expect(all("institutions").map((i) => i.name)).toEqual(["Banco Próprio Fictício"]);
      expect(
        all("accounts")
          .map((a) => a.id)
          .sort(),
      ).toEqual([account.id, archived.id].sort());
      expect(all("categories")).toHaveLength(99);
      expect(all("import_batches")).toHaveLength(1);
      const txs = all("transactions");
      expect(txs).toHaveLength(12);
      expect(txs.filter((t) => t.deletedAt)).toHaveLength(1);
      expect(all("audit_log").length).toBeGreaterThan(12);
      const owners = new Set([
        ...all("accounts").map((a) => a.ownerId),
        ...all("categories").map((c) => c.ownerId),
        ...all("import_batches").map((b) => b.ownerId),
        ...txs.map((t) => t.ownerId),
      ]);
      expect(owners).toEqual(new Set([store.ownerId]));
      const otherIds = new Set([otherAccount.id]);
      expect(all("audit_log").some((e) => otherIds.has(e.entityId))).toBe(false);
    });
  });
}
