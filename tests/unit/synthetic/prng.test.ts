import { describe, expect, it } from "vitest";
import { mulberry32 } from "@/synthetic/prng";

describe("mulberry32", () => {
  it("é determinístico por semente e fica em [0, 1)", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = Array.from({ length: 1000 }, () => a());
    const seqB = Array.from({ length: 1000 }, () => b());
    expect(seqA).toEqual(seqB);
    expect(seqA.every((n) => n >= 0 && n < 1)).toBe(true);
  });

  it("sementes diferentes geram sequências diferentes", () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
});
