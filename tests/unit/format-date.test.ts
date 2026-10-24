import { afterEach, describe, expect, it } from "vitest";
import {
  addDays,
  dateToSpeech,
  formatAbsoluteDate,
  formatPeriod,
  formatRelativeDate,
  todayInSaoPaulo,
} from "@/lib/format";

/** data-model §5 — FR-029, FR-030. Datas de negócio são `YYYY-MM-DD` no fuso de São Paulo. */
const TODAY = "2026-09-30";
const ORIGINAL_TZ = process.env.TZ;

afterEach(() => {
  process.env.TZ = ORIGINAL_TZ;
});

describe("formatRelativeDate", () => {
  it.each([
    ["2026-09-30", "Hoje"],
    ["2026-09-29", "Ontem"],
    ["2026-10-01", "Amanhã"],
    ["2026-09-28", "28 set."],
    ["2026-05-02", "2 mai."],
    ["2026-10-15", "15 out."],
    ["2025-09-28", "28 set. 2025"],
    ["2027-01-03", "3 jan. 2027"],
  ])("%s → %s", (date, expected) => {
    expect(formatRelativeDate(date, TODAY)).toBe(expected);
  });

  it("vira o ano corretamente (Ontem em 1º de janeiro)", () => {
    expect(formatRelativeDate("2025-12-31", "2026-01-01")).toBe("Ontem");
    expect(formatRelativeDate("2025-12-30", "2026-01-01")).toBe("30 dez. 2025");
  });

  it("não depende do fuso do processo", () => {
    process.env.TZ = "Pacific/Kiritimati";
    expect(formatRelativeDate("2026-09-29", TODAY)).toBe("Ontem");
    process.env.TZ = "Pacific/Pago_Pago";
    expect(formatRelativeDate("2026-10-01", TODAY)).toBe("Amanhã");
  });

  it("todos os meses abreviados", () => {
    const months = Array.from({ length: 12 }, (_, i) =>
      formatRelativeDate(`2026-${String(i + 1).padStart(2, "0")}-10`, "2026-12-31"),
    );
    expect(months).toEqual([
      "10 jan.",
      "10 fev.",
      "10 mar.",
      "10 abr.",
      "10 mai.",
      "10 jun.",
      "10 jul.",
      "10 ago.",
      "10 set.",
      "10 out.",
      "10 nov.",
      "10 dez.",
    ]);
  });
});

describe("formas absolutas e faladas", () => {
  it("formatAbsoluteDate", () => {
    expect(formatAbsoluteDate("2026-09-28")).toBe("28/09/2026");
    expect(formatAbsoluteDate("2026-10-02")).toBe("02/10/2026");
  });

  it("dateToSpeech", () => {
    expect(dateToSpeech("2026-09-28")).toBe("28 de setembro de 2026");
    expect(dateToSpeech("2026-03-01")).toBe("1 de março de 2026");
  });

  it("addDays atravessa meses e anos", () => {
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });
});

describe("formatPeriod", () => {
  it.each([
    [{ month: "2026-09" }, "Setembro de 2026"],
    [{ month: "2026-03" }, "Março de 2026"],
    [{ from: "2026-09-01", to: "2026-09-15" }, "1–15 set."],
    [{ from: "2026-09-28", to: "2026-10-03" }, "28 set. – 3 out."],
    [{ from: "2025-12-28", to: "2026-01-03" }, "28 dez. 2025 – 3 jan. 2026"],
    [{ from: "2026-09-28" }, "28 set."],
    [{ from: "2026-09-28", to: "2026-09-28" }, "28 set."],
  ])("%j → %s", (period, expected) => {
    expect(formatPeriod(period)).toBe(expected);
  });
});

describe("todayInSaoPaulo", () => {
  it("calcula a virada do dia no fuso de São Paulo", () => {
    expect(todayInSaoPaulo(new Date("2026-10-03T02:59:59Z"))).toBe("2026-10-02");
    expect(todayInSaoPaulo(new Date("2026-10-03T03:00:00Z"))).toBe("2026-10-03");
  });

  it("ignora o fuso do processo/aparelho", () => {
    process.env.TZ = "Asia/Tokyo";
    expect(todayInSaoPaulo(new Date("2026-10-03T02:30:00Z"))).toBe("2026-10-02");
    process.env.TZ = "America/Los_Angeles";
    expect(todayInSaoPaulo(new Date("2026-10-03T04:30:00Z"))).toBe("2026-10-03");
  });
});
