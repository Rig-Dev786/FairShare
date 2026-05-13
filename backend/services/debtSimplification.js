const { toCents, fromCents } = require('../utils/money');

/**
 * Minimum Cash Flow greedy algorithm.
 *
 * Mathematically minimises the number of transactions required to fully
 * settle all debts in a group.  Works in integer cents throughout to
 * eliminate floating-point accumulation errors.
 *
 * Complexity: O(n²)  — optimal for typical group sizes (≤ 20 members).
 *
 * @param {Array<{user_id: string, full_name: string, username: string, balance: string|number}>} balances
 * @returns {Array<{from, fromName, fromUser, to, toName, toUser, amount}>}
 */
function minimizeCashFlow(balances) {
  const people = balances.map((b) => ({
    id:       b.user_id,
    name:     b.full_name,
    username: b.username,
    cents:    toCents(b.balance),
  }));

  const transactions = [];

  while (true) {
    // Sort descending: largest creditor first, largest debtor last
    people.sort((a, b) => b.cents - a.cents);

    const creditor = people[0];
    const debtor   = people[people.length - 1];

    // All balances effectively zero — finished
    if (creditor.cents <= 0 || debtor.cents >= 0) break;

    const settleCents = Math.min(creditor.cents, -debtor.cents);

    transactions.push({
      from:     debtor.id,
      fromName: debtor.name,
      fromUser: debtor.username,
      to:       creditor.id,
      toName:   creditor.name,
      toUser:   creditor.username,
      amount:   fromCents(settleCents),
    });

    creditor.cents -= settleCents;
    debtor.cents   += settleCents;
  }

  return transactions;
}

module.exports = { minimizeCashFlow };
