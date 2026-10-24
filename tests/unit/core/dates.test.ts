import { describe, expect, it } from "vitest";
import { isIsoDate, toSaoPauloDate, todayInSaoPaulo } from "@/domain/core/dates";

// 004 · T005 — FR-013 e US1 cenário 6.
describe("isIsoDate", () => {
  it.each(["2026-09-30", "1900-01-01", "2100-12-31", "2024-02-29", "2030-01-15"])(
    "aceita %s (calendário real; data futura válida)",
    (value) => expect(isIsoDate(value)).toBe(true),
  );

  it.each([
    "2026-02-30",
    "2025-02-29",
    "2026-13-01",
    "1899-12-31",
    "2101-01-01",
    "2026-9-30",
    "30/09/2026",
    "",
    null,
    20260930,
  ])("rejeita %s", (value) => expect(isIsoDate(value)).toBe(false));
});

describe("toSaoPauloDate", () => {
  it("converte o instante UTC para a data de São Paulo", () => {
    expect(toSaoPauloDate("2026-10-01T02:30:00Z")).toBe("2026-09-30");
    expect(toSaoPauloDate("2026-10-01T03:00:00Z")).toBe("2026-10-01");
    expect(toSaoPauloDate(new Date("2026-01-01T12:00:00Z"))).toBe("2026-01-01");
  });

  it("recusa instante inválido", () => {
    expect(() => toSaoPauloDate("não é data")).toThrow();
  });
});

describe("todayInSaoPaulo", () => {
  it("usa o relógio injetado", () => {
    expect(todayInSaoPaulo(() => new Date("2026-10-08T01:00:00Z"))).toBe("2026-10-07");
  });
});
