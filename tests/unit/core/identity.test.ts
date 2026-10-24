import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { fingerprintBase, fpIdentity, OccurrenceCounter } from "@/domain/core/identity";

// 004 · T020 — identidade determinística (R-06; FR-021, FR-022).
const row = {
  accountId: "6f1c1f0e-0d51-4a43-9a0c-4c4a3a4b7d10",
  bookedOn: "2026-09-12",
  amountCents: -800,
  descriptionOriginal: "Café Grão  Fictício",
};
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

describe("fingerprintBase", () => {
  it("é sha256 de conta|data|valor|descrição normalizada", () => {
    expect(fingerprintBase(row)).toBe(sha(`${row.accountId}|2026-09-12|-800|CAFE GRAO FICTICIO`));
  });

  it("é determinística e ignora acento, espaço e caixa", () => {
    expect(fingerprintBase(row)).toBe(fingerprintBase({ ...row }));
    expect(fingerprintBase({ ...row, descriptionOriginal: " cafe grao ficticio" })).toBe(
      fingerprintBase(row),
    );
  });

  it("muda com conta, data, valor ou descrição", () => {
    const base = fingerprintBase(row);
    expect(fingerprintBase({ ...row, accountId: "00000000-0000-4000-8000-000000000001" })).not.toBe(
      base,
    );
    expect(fingerprintBase({ ...row, bookedOn: "2026-09-13" })).not.toBe(base);
    expect(fingerprintBase({ ...row, amountCents: -801 })).not.toBe(base);
    expect(fingerprintBase({ ...row, descriptionOriginal: "Padaria" })).not.toBe(base);
  });
});

describe("fpIdentity", () => {
  it('= "fp:" + sha256(base|k)', () => {
    const base = fingerprintBase(row);
    expect(fpIdentity(base, 1)).toBe(`fp:${sha(`${base}|1`)}`);
    expect(fpIdentity(base, 2)).not.toBe(fpIdentity(base, 1));
  });
});

describe("OccurrenceCounter", () => {
  it("conta por base no lote inteiro, inclusive entre chamadas", () => {
    const counter = new OccurrenceCounter();
    expect(counter.next("a")).toBe(1);
    expect(counter.next("b")).toBe(1);
    expect(counter.next("a")).toBe(2);
    const resumed = new OccurrenceCounter(counter.snapshot());
    expect(resumed.next("a")).toBe(3);
    expect(counter.snapshot()).toEqual({ a: 2, b: 1 });
  });
});
