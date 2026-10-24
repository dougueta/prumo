import type { Account, AccountBalance, IsoDate, Transaction } from "./types";

/**
 * Saldo calculado × informado (R-09, FR-010) — espelho de `core_account_balances`.
 * computed(d) = saldo inicial + Σ amountCents das transações `posted`, não excluídas, com
 * openingBalanceOn ≤ bookedOn ≤ d. Pendentes ficam fora. divergence = reported − computed(reportedOn).
 */
export function computeBalances(
  accounts: Account[],
  transactions: Transaction[],
  asOf: IsoDate,
): AccountBalance[] {
  return accounts.map((account) => {
    const computedAt = (d: IsoDate) =>
      transactions
        .filter(
          (t) =>
            t.accountId === account.id &&
            t.status === "posted" &&
            !t.deletedAt &&
            t.bookedOn <= d &&
            (account.openingBalanceOn === null || t.bookedOn >= account.openingBalanceOn),
        )
        .reduce((sum, t) => sum + t.amountCents, account.openingBalanceCents);
    const atReported =
      account.reportedBalanceOn === null ? null : computedAt(account.reportedBalanceOn);
    return {
      accountId: account.id,
      reportedCents: account.reportedBalanceCents,
      reportedOn: account.reportedBalanceOn,
      computedCents: computedAt(asOf),
      computedAtReportedCents: atReported,
      divergenceCents:
        atReported === null || account.reportedBalanceCents === null
          ? null
          : account.reportedBalanceCents - atReported,
    };
  });
}
