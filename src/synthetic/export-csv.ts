import type { SyntheticDataset } from "@/synthetic/generate";

/** CSV no padrão de bancos brasileiros: UTF-8 com BOM, `;`, vírgula decimal, CRLF. */
export function toCsv(data: SyntheticDataset, accountId: string): string {
  const lines = ["data;descricao;valor"];
  for (const t of data.transactions) {
    if (t.accountId !== accountId) continue;
    const [year, month, day] = t.date.split("-");
    const abs = Math.abs(t.amountCents);
    const value = `${t.amountCents < 0 ? "-" : ""}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, "0")}`;
    lines.push(`${day}/${month}/${year};${t.description.replaceAll(";", ",")};${value}`);
  }
  return `﻿${lines.join("\r\n")}\r\n`;
}
