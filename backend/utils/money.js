/**
 * Financial math helpers.
 * All monetary arithmetic is done in integer cents to avoid IEEE-754 drift.
 */

const toCents   = (amount) => Math.round(parseFloat(amount) * 100);
const fromCents = (cents)  => (cents / 100).toFixed(2);

/**
 * Split totalCents as equally as possible among n people.
 * Distributes any remainder (penny rounding) to the first participants.
 * Guarantees: sum of returned array === totalCents exactly.
 */
function equalSplitCents(totalCents, n) {
  const base      = Math.floor(totalCents / n);
  const remainder = totalCents % n;
  return Array.from({ length: n }, (_, i) =>
    i < remainder ? base + 1 : base
  );
}

module.exports = { toCents, fromCents, equalSplitCents };
