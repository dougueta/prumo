import { createRandom } from "@/synthetic/prng";
import {
  ACCOUNTS,
  INSTALLMENT_PURCHASES,
  INSTITUTIONS,
  INTERNATIONAL,
  MERCHANTS,
  MONTHLY_FEE,
  REFUND,
  SALARIES,
  SUBSCRIPTIONS,
  WALLET_TOP_UP_CENTS,
} from "@/synthetic/profile";

/** Formato próprio v1 — specs/001-setup-projeto/data-model.md §5 (a feature 004 adapta). */

export type TransactionKind =
  | "salary"
  | "purchase"
  | "subscription"
  | "installment"
  | "transfer_internal"
  | "card_bill_payment"
  | "refund"
  | "international"
  | "fee"
  | "income_other";

export type SyntheticTransaction = {
  id: string;
  accountId: string;
  date: string;
  description: string;
  amountCents: number;
  kind: TransactionKind;
  installment?: { number: number; total: number; groupId: string };
  transferGroupId?: string;
  originalCurrency?: { code: string; amountMinor: number };
  synthetic: true;
};

export type SyntheticAccount = {
  id: string;
  institutionId: string;
  name: string;
  type: "checking" | "wallet" | "credit_card";
  receivesSalary: boolean;
  creditLimitCents?: number;
  closingDay?: number;
  dueDay?: number;
};

export type SyntheticDataset = {
  schemaVersion: 1;
  synthetic: true;
  seed: number;
  anchorDate: string;
  months: number;
  institutions: { id: string; name: string; kind: "bank" | "wallet" }[];
  accounts: SyntheticAccount[];
  transactions: SyntheticTransaction[];
};

export type GenerateParams = { seed: number; months: number; anchorDate: string };

type Draft = Omit<SyntheticTransaction, "id" | "synthetic">;
type Month = { year: number; month: number; lastDay: number };

const pad = (n: number) => String(n).padStart(2, "0");

function monthsEndingAt(anchorDate: string, count: number): Month[] {
  const [anchorYear, anchorMonth, anchorDay] = anchorDate.split("-").map(Number);
  const result: Month[] = [];
  for (let offset = count - 1; offset >= 0; offset--) {
    const index = anchorYear * 12 + (anchorMonth - 1) - offset;
    const year = Math.floor(index / 12);
    const month = (index % 12) + 1;
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    result.push({ year, month, lastDay: offset === 0 ? anchorDay : daysInMonth });
  }
  return result;
}

export function generateDataset({ seed, months, anchorDate }: GenerateParams): SyntheticDataset {
  if (!Number.isInteger(months) || months < 12) throw new RangeError("months deve ser >= 12");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(anchorDate)) throw new RangeError("anchorDate inválida");

  const random = createRandom(seed);
  const window = monthsEndingAt(anchorDate, months);
  const drafts: Draft[] = [];
  let groupCounter = 0;
  const nextGroup = (prefix: string) => `${seed}-${prefix}-${++groupCounter}`;

  const dateIn = (m: Month, day: number) =>
    `${m.year}-${pad(m.month)}-${pad(Math.min(day, m.lastDay))}`;
  const add = (draft: Draft) => drafts.push(draft);
  const transfer = (
    m: Month,
    day: number,
    from: string,
    to: string,
    cents: number,
    kind: TransactionKind,
    description: string,
  ) => {
    const transferGroupId = nextGroup("tg");
    add({
      accountId: from,
      date: dateIn(m, day),
      description,
      amountCents: -cents,
      kind,
      transferGroupId,
    });
    add({
      accountId: to,
      date: dateIn(m, day),
      description,
      amountCents: cents,
      kind,
      transferGroupId,
    });
  };

  const cards = [
    { card: ACCOUNTS.orbitaCard, payer: ACCOUNTS.aurora.id },
    { card: ACCOUNTS.horizonteCard, payer: ACCOUNTS.horizonte.id },
  ];
  const installmentGroups = INSTALLMENT_PURCHASES.map(() => nextGroup("inst"));

  window.forEach((m, monthIndex) => {
    for (const salary of SALARIES) {
      add({
        accountId: salary.accountId,
        date: dateIn(m, salary.day),
        description: salary.description,
        amountCents: salary.cents,
        kind: "salary",
      });
    }

    for (const sub of SUBSCRIPTIONS) {
      const raised = "raiseFromMonth" in sub && monthIndex >= sub.raiseFromMonth;
      const cents = raised ? sub.raisedCents : sub.cents;
      add({
        accountId: sub.accountId,
        date: dateIn(m, sub.day),
        description: sub.description,
        amountCents: -cents,
        kind: "subscription",
      });
    }

    const purchases = random.int(30, 60);
    for (let i = 0; i < purchases; i++) {
      const roll = random.next();
      const accountId =
        roll < 0.7
          ? ACCOUNTS.orbitaCard.id
          : roll < 0.9
            ? ACCOUNTS.horizonteCard.id
            : ACCOUNTS.pix.id;
      const merchant = random.pick(MERCHANTS);
      add({
        accountId,
        date: dateIn(m, random.int(1, m.lastDay)),
        description: merchant.description,
        amountCents: -random.int(merchant.min, merchant.max),
        kind: "purchase",
      });
    }

    transfer(
      m,
      6,
      ACCOUNTS.aurora.id,
      ACCOUNTS.pix.id,
      WALLET_TOP_UP_CENTS,
      "transfer_internal",
      "Transferência entre contas próprias",
    );

    if (monthIndex % 3 === 1) {
      add({
        accountId: ACCOUNTS.pix.id,
        date: dateIn(m, random.int(1, m.lastDay)),
        description: "Pix recebido (simulado)",
        amountCents: random.int(2_000, 15_000),
        kind: "income_other",
      });
    }

    if (monthIndex % 4 === 0) {
      add({
        accountId: MONTHLY_FEE.accountId,
        date: dateIn(m, MONTHLY_FEE.day),
        description: MONTHLY_FEE.description,
        amountCents: -MONTHLY_FEE.cents,
        kind: "fee",
      });
    }

    INSTALLMENT_PURCHASES.forEach((purchase, index) => {
      const number = monthIndex - purchase.startMonth + 1;
      if (number < 1 || number > purchase.total) return;
      add({
        accountId: purchase.accountId,
        date: dateIn(m, purchase.day),
        description: `${purchase.description} ${number}/${purchase.total}`,
        amountCents: -purchase.cents,
        kind: "installment",
        installment: { number, total: purchase.total, groupId: installmentGroups[index] },
      });
    });

    if (monthIndex === REFUND.month) {
      add({
        accountId: REFUND.accountId,
        date: dateIn(m, REFUND.day),
        description: REFUND.description,
        amountCents: REFUND.cents,
        kind: "refund",
      });
    }

    if (monthIndex === INTERNATIONAL.month) {
      add({
        accountId: INTERNATIONAL.accountId,
        date: dateIn(m, INTERNATIONAL.day),
        description: INTERNATIONAL.description,
        amountCents: -INTERNATIONAL.brlCents,
        kind: "international",
        originalCurrency: { code: "USD", amountMinor: INTERNATIONAL.usdMinor },
      });
    }

    // Pagamento da fatura: soma do mês anterior de cada cartão, paga no vencimento deste mês.
    if (monthIndex > 0) {
      const previous = window[monthIndex - 1];
      const prefix = `${previous.year}-${pad(previous.month)}`;
      for (const { card, payer } of cards) {
        const due = -drafts
          .filter(
            (d) =>
              d.accountId === card.id &&
              d.date.startsWith(prefix) &&
              d.kind !== "card_bill_payment",
          )
          .reduce((sum, d) => sum + d.amountCents, 0);
        if (due > 0)
          transfer(
            m,
            card.dueDay,
            payer,
            card.id,
            due,
            "card_bill_payment",
            `Pagamento de fatura ${card.name}`,
          );
      }
    }
  });

  const transactions: SyntheticTransaction[] = drafts
    .map((draft, sequence) => ({ draft, sequence }))
    .sort(
      (a, b) =>
        a.draft.date.localeCompare(b.draft.date) ||
        a.draft.accountId.localeCompare(b.draft.accountId) ||
        a.sequence - b.sequence,
    )
    .map(({ draft }, index) => ({
      id: `${seed}-${index + 1}`,
      ...draft,
      synthetic: true as const,
    }));

  return {
    schemaVersion: 1,
    synthetic: true,
    seed,
    anchorDate,
    months,
    institutions: INSTITUTIONS.map((i) => ({ ...i })),
    accounts: Object.values(ACCOUNTS).map((a) => ({ ...a })),
    transactions,
  };
}
