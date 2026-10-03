import { XMLParser, XMLValidator } from "fast-xml-parser";
import { describe, expect, it } from "vitest";
import { toCsv } from "@/synthetic/export-csv";
import { toOfx } from "@/synthetic/export-ofx";
import { generateDataset } from "@/synthetic/generate";

const data = generateDataset({ seed: 42, months: 12, anchorDate: "2026-09-30" });
const account = data.accounts[0];
const rows = data.transactions.filter((t) => t.accountId === account.id);

function brl(cents: number) {
  const abs = Math.abs(cents);
  const sign = cents < 0 ? "-" : "";
  return `${sign}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, "0")}`;
}

describe("CSV (FR-016)", () => {
  const csv = toCsv(data, account.id);
  const lines = csv.replace(/^﻿/, "").trim().split("\r\n");

  it("usa BOM, ; e cabeçalho padrão", () => {
    expect(csv.startsWith("﻿")).toBe(true);
    expect(lines[0]).toBe("data;descricao;valor");
  });

  it("formata data DD/MM/AAAA e valor com vírgula decimal", () => {
    expect(lines).toHaveLength(rows.length + 1);
    const [date, , value] = lines[1].split(";");
    expect(date).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    expect(value).toBe(brl(rows[0].amountCents));
  });
});

describe("OFX 2.x (FR-016)", () => {
  const ofx = toOfx(data, account.id);
  const xml = ofx.slice(ofx.indexOf("<OFX>"));

  it("tem cabeçalho OFX 2 e XML válido", () => {
    expect(ofx).toMatch(/<\?OFX OFXHEADER="200" VERSION="220"/);
    expect(XMLValidator.validate(xml)).toBe(true);
  });

  it("tem BRL e transações com FITID estável e valor com ponto", () => {
    const parsed = new XMLParser({ parseTagValue: false }).parse(xml);
    const statement = parsed.OFX.BANKMSGSRSV1.STMTTRNRS.STMTRS;
    expect(statement.CURDEF).toBe("BRL");
    const list = [statement.BANKTRANLIST.STMTTRN].flat();
    expect(list).toHaveLength(rows.length);
    expect(list[0].FITID).toBe(rows[0].id);
    expect(list[0].DTPOSTED).toBe(rows[0].date.replaceAll("-", ""));
    expect(list[0].TRNAMT).toBe((rows[0].amountCents / 100).toFixed(2));
  });

  it("é determinístico", () => {
    expect(toOfx(data, account.id)).toBe(ofx);
  });
});
