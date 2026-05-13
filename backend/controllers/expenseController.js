const pool                         = require('../db/pool');
const { toCents, equalSplitCents } = require('../utils/money');
const { minimizeCashFlow }         = require('../services/debtSimplification');

// ─────────────────────────────────────────────────────────────
//  POST /api/expenses
//
//  Body (JSON):
//  {
//    group_id:     "uuid",
//    paid_by:      "uuid",
//    title:        "Dinner at Spice Garden",
//    total_amount: 1200.00,
//    category:     "Food",          // optional, default "Other"
//    split_method: "EQUAL",         // "EQUAL" | "EXACT"
//    participants: [
//      { user_id: "uuid" },                         // EQUAL
//      { user_id: "uuid", owed_amount: "400.00" }   // EXACT
//    ],
//    notes: "..."                   // optional
//  }
//
//  Uses a full ACID transaction: if any ExpenseSplits insert fails,
//  the whole operation rolls back (including the Expenses row).
// ─────────────────────────────────────────────────────────────
async function createExpense(req, res) {
  const {
    group_id,
    paid_by,
    title,
    total_amount,
    category     = 'Other',
    split_method = 'EQUAL',
    participants = [],
    notes,
  } = req.body;

  // Input validation
  if (!group_id || !paid_by || !title || !total_amount || participants.length === 0) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  const totalCents = toCents(total_amount);
  if (totalCents <= 0) {
    return res.status(400).json({ error: 'total_amount must be positive.' });
  }

  // Build splits array (cents) before opening the DB transaction
  let splits = [];

  if (split_method === 'EQUAL') {
    const centAmounts = equalSplitCents(totalCents, participants.length);
    splits = participants.map((p, i) => ({
      user_id:    p.user_id,
      owed_cents: centAmounts[i],
    }));
  } else if (split_method === 'EXACT') {
    const sumCents = participants.reduce((acc, p) => acc + toCents(p.owed_amount), 0);
    if (Math.abs(sumCents - totalCents) > 1) {
      return res.status(400).json({
        error: `Splits sum (${sumCents}¢) ≠ total (${totalCents}¢).`,
      });
    }
    splits = participants.map((p) => ({
      user_id:    p.user_id,
      owed_cents: toCents(p.owed_amount),
    }));
  } else {
    return res.status(400).json({ error: 'Unsupported split_method. Use EQUAL or EXACT.' });
  }

  // ACID transaction
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Insert Expense row
    const expenseResult = await client.query(
      `INSERT INTO Expenses
         (group_id, paid_by, title, total_amount, category, split_method, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING expense_id, created_at`,
      [
        group_id,
        paid_by,
        title,
        (totalCents / 100).toFixed(2),
        category,
        split_method,
        notes || null,
      ]
    );

    const { expense_id, created_at } = expenseResult.rows[0];

    // 2. Insert each split — the DB trigger fires on every row and
    //    automatically updates NetBalances via upsert.
    for (const split of splits) {
      await client.query(
        `INSERT INTO ExpenseSplits (expense_id, user_id, owed_amount)
         VALUES ($1, $2, $3)`,
        [expense_id, split.user_id, (split.owed_cents / 100).toFixed(2)]
      );
    }

    await client.query('COMMIT');

    return res.status(201).json({
      message:      'Expense created successfully.',
      expense_id,
      created_at,
      splits_count: splits.length,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[createExpense] Transaction rolled back:', err.message);

    // Surface named DB constraint exceptions
    if (err.message.startsWith('PAYER_NOT_MEMBER')) {
      return res.status(400).json({ error: err.message });
    }
    if (err.message.startsWith('SPLIT_MISMATCH')) {
      return res.status(400).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Internal error. Transaction rolled back.' });
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────────────────────
//  GET /api/groups/:groupId/settlements
// ─────────────────────────────────────────────────────────────
async function getSettlements(req, res) {
  const { groupId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT user_id, full_name, username, balance
         FROM vw_group_balances
        WHERE group_id = $1
          AND balance  <> 0
        ORDER BY balance DESC`,
      [groupId]
    );

    if (rows.length === 0) {
      return res.json({ settlements: [], message: 'All debts are settled.' });
    }

    return res.json({ settlements: minimizeCashFlow(rows) });
  } catch (err) {
    console.error('[getSettlements]', err.message);
    return res.status(500).json({ error: 'Failed to compute settlements.' });
  }
}

// ─────────────────────────────────────────────────────────────
//  GET /api/groups/:groupId/expenses/food?userId=<uuid>
//  Complex JOIN query — Food / last 30 days / participant but not payer
// ─────────────────────────────────────────────────────────────
async function getFoodExpenses(req, res) {
  const { groupId } = req.params;
  const { userId }  = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'userId query param is required.' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT
         e.expense_id,
         e.title,
         e.total_amount,
         e.created_at                           AS expense_date,
         payer.full_name                        AS paid_by_name,
         payer.username                         AS paid_by_username,
         es.owed_amount                         AS user_owes,
         ROUND(es.owed_amount / e.total_amount * 100, 2) AS pct_of_total,
         e.notes
       FROM  Expenses         e
       JOIN  ExpenseSplits    es    ON es.expense_id = e.expense_id
                                   AND es.user_id    = $2
       JOIN  Users            payer ON payer.user_id = e.paid_by
       WHERE e.group_id  = $1
         AND e.category  = 'Food'
         AND e.created_at >= NOW() - INTERVAL '30 days'
         AND e.paid_by   != $2
       ORDER BY e.created_at DESC`,
      [groupId, userId]
    );

    return res.json({ expenses: rows });
  } catch (err) {
    console.error('[getFoodExpenses]', err.message);
    return res.status(500).json({ error: 'Query failed.' });
  }
}

// ─────────────────────────────────────────────────────────────
//  GET /api/groups/:groupId/balances
// ─────────────────────────────────────────────────────────────
async function getGroupBalances(req, res) {
  const { groupId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT user_id, full_name, username, balance, updated_at
         FROM vw_group_balances
        WHERE group_id = $1
        ORDER BY balance DESC`,
      [groupId]
    );
    return res.json({ balances: rows });
  } catch (err) {
    console.error('[getGroupBalances]', err.message);
    return res.status(500).json({ error: 'Failed to fetch balances.' });
  }
}

// ─────────────────────────────────────────────────────────────
//  GET /api/groups
// ─────────────────────────────────────────────────────────────
async function listGroups(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT
         g.group_id,
         g.group_name,
         g.description,
         u.full_name       AS created_by_name,
         COUNT(gm.user_id) AS member_count
       FROM   Groups       g
       JOIN   Users        u  ON u.user_id  = g.created_by
       JOIN   GroupMembers gm ON gm.group_id = g.group_id
       GROUP  BY g.group_id, u.full_name
       ORDER  BY g.created_at DESC`
    );
    return res.json({ groups: rows });
  } catch (err) {
    console.error('[listGroups]', err.message);
    return res.status(500).json({ error: 'Failed to fetch groups.' });
  }
}

module.exports = {
  createExpense,
  getSettlements,
  getFoodExpenses,
  getGroupBalances,
  listGroups,
};
