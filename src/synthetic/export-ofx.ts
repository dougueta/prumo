import type { SyntheticDataset } from "@/synthetic/generate";

/** OFX 2.2 (XML) determinístico — sem timestamps do relógio, só datas do próprio dataset. */

const escape = (text: string) =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

const ofxDate = (iso: string) => iso.replaceAll("-", "");

export function toOfx(data: SyntheticDataset, accountId: string): string {
  const account = data.accounts.find((a) => a.id === accountId);
  if (!account) throw new Error(`Conta inexistente no dataset: ${accountId}`);
  const rows = data.transactions.filter((t) => t.accountId === accountId);
  const start = rows[0]?.date ?? data.anchorDate;
  const end = data.anchorDate;
  const balance = rows.reduce((sum, t) => sum + t.amountCents, 0);

  const transactions = rows
    .map(
      (t) => `<STMTTRN>
<TRNTYPE>${t.amountCents < 0 ? "DEBIT" : "CREDIT"}</TRNTYPE>
<DTPOSTED>${ofxDate(t.date)}</DTPOSTED>
<TRNAMT>${(t.amountCents / 100).toFixed(2)}</TRNAMT>
<FITID>${t.id}</FITID>
<NAME>${escape(t.description.slice(0, 32))}</NAME>
<MEMO>${escape(t.description)}</MEMO>
</STMTTRN>`,
    )
    .join("\n");

  const isCard = account.type === "credit_card";
  const statementBody = `<CURDEF>BRL</CURDEF>
${isCard ? `<CCACCTFROM><ACCTID>${account.id}</ACCTID></CCACCTFROM>` : `<BANKACCTFROM><BANKID>000</BANKID><ACCTID>${account.id}</ACCTID><ACCTTYPE>CHECKING</ACCTTYPE></BANKACCTFROM>`}
<BANKTRANLIST>
<DTSTART>${ofxDate(start)}</DTSTART>
<DTEND>${ofxDate(end)}</DTEND>
${transactions}
</BANKTRANLIST>
<LEDGERBAL><BALAMT>${(balance / 100).toFixed(2)}</BALAMT><DTASOF>${ofxDate(end)}</DTASOF></LEDGERBAL>`;

  const message = isCard
    ? `<CREDITCARDMSGSRSV1><CCSTMTTRNRS><TRNUID>${account.id}</TRNUID><STATUS><CODE>0</CODE><SEVERITY>INFO</SEVERITY></STATUS><CCSTMTRS>
${statementBody}
</CCSTMTRS></CCSTMTTRNRS></CREDITCARDMSGSRSV1>`
    : `<BANKMSGSRSV1><STMTTRNRS><TRNUID>${account.id}</TRNUID><STATUS><CODE>0</CODE><SEVERITY>INFO</SEVERITY></STATUS><STMTRS>
${statementBody}
</STMTRS></STMTTRNRS></BANKMSGSRSV1>`;

  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<?OFX OFXHEADER="200" VERSION="220" SECURITY="NONE" OLDFILEUID="NONE" NEWFILEUID="NONE"?>
<OFX>
<SIGNONMSGSRSV1><SONRS><STATUS><CODE>0</CODE><SEVERITY>INFO</SEVERITY></STATUS><DTSERVER>${ofxDate(end)}</DTSERVER><LANGUAGE>POR</LANGUAGE></SONRS></SIGNONMSGSRSV1>
${message}
</OFX>
`;
}
