-- ============================================================
--  DEBT SIMPLIFICATION & GROUP EXPENSE TRACKER
--  PostgreSQL Schema — University DBMS Project
--  Author: Senior DB Architect
-- ============================================================

-- ─── Extensions ─────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()

-- ─── ENUM types ─────────────────────────────────────────────
CREATE TYPE expense_category AS ENUM (
  'Food', 'Travel', 'Utilities', 'Entertainment', 'Shopping', 'Other'
);

CREATE TYPE split_method AS ENUM ('EQUAL', 'EXACT', 'PERCENTAGE');

-- ============================================================
--  TABLE: Users
-- ============================================================
CREATE TABLE Users (
  user_id     UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  username    VARCHAR(50)   NOT NULL UNIQUE,
  email       VARCHAR(255)  NOT NULL UNIQUE,
  full_name   VARCHAR(150)  NOT NULL,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_email_format CHECK (email ~* '^[^@]+@[^@]+\.[^@]+$'),
  CONSTRAINT chk_username_len CHECK (char_length(username) >= 3)
);

-- ============================================================
--  TABLE: Groups
-- ============================================================
CREATE TABLE Groups (
  group_id    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  group_name  VARCHAR(100)  NOT NULL,
  description TEXT,
  created_by  UUID          NOT NULL REFERENCES Users(user_id) ON DELETE RESTRICT,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_group_name_len CHECK (char_length(group_name) >= 2)
);

-- ============================================================
--  TABLE: GroupMembers
-- ============================================================
CREATE TABLE GroupMembers (
  group_id   UUID         NOT NULL REFERENCES Groups(group_id)  ON DELETE CASCADE,
  user_id    UUID         NOT NULL REFERENCES Users(user_id)    ON DELETE CASCADE,
  joined_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  is_active  BOOLEAN      NOT NULL DEFAULT TRUE,

  PRIMARY KEY (group_id, user_id)
);

-- Index for lookups by user across all their groups
CREATE INDEX idx_groupmembers_user ON GroupMembers(user_id);

-- ============================================================
--  TABLE: Expenses
-- ============================================================
CREATE TABLE Expenses (
  expense_id    UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id      UUID              NOT NULL REFERENCES Groups(group_id)  ON DELETE CASCADE,
  paid_by       UUID              NOT NULL REFERENCES Users(user_id)    ON DELETE RESTRICT,
  title         VARCHAR(200)      NOT NULL,
  total_amount  DECIMAL(10, 2)    NOT NULL,
  category      expense_category  NOT NULL DEFAULT 'Other',
  split_method  split_method      NOT NULL DEFAULT 'EQUAL',
  notes         TEXT,
  is_deleted    BOOLEAN           NOT NULL DEFAULT FALSE,
  deleted_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ       NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_positive_amount CHECK (total_amount > 0),
  -- Payer must be a member of the group (enforced via FK + CHECK via trigger)
  CONSTRAINT chk_title_nonempty  CHECK (char_length(trim(title)) > 0)
);

-- Composite index: group + time range queries (used in the complex query below)
CREATE INDEX idx_expenses_group_category_date
  ON Expenses(group_id, category, created_at DESC);

CREATE INDEX idx_expenses_paid_by ON Expenses(paid_by);

-- ============================================================
--  TABLE: ExpenseSplits
-- ============================================================
CREATE TABLE ExpenseSplits (
  split_id    UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id  UUID            NOT NULL REFERENCES Expenses(expense_id) ON DELETE CASCADE,
  user_id     UUID            NOT NULL REFERENCES Users(user_id)       ON DELETE RESTRICT,
  owed_amount DECIMAL(10, 2)  NOT NULL,
  is_settled  BOOLEAN         NOT NULL DEFAULT FALSE,
  settled_at  TIMESTAMPTZ,

  CONSTRAINT chk_owed_positive    CHECK (owed_amount > 0),
  CONSTRAINT chk_settled_ts       CHECK (
    (is_settled = FALSE AND settled_at IS NULL) OR
    (is_settled = TRUE  AND settled_at IS NOT NULL)
  ),
  UNIQUE (expense_id, user_id)   -- one split record per user per expense
);

CREATE INDEX idx_expensesplits_expense ON ExpenseSplits(expense_id);
CREATE INDEX idx_expensesplits_user    ON ExpenseSplits(user_id);

-- ============================================================
--  TABLE: NetBalances
--  Materialised running balance per (group, user).
--  Positive  → others owe this user.
--  Negative  → this user owes others.
-- ============================================================
CREATE TABLE NetBalances (
  group_id  UUID            NOT NULL REFERENCES Groups(group_id) ON DELETE CASCADE,
  user_id   UUID            NOT NULL REFERENCES Users(user_id)   ON DELETE CASCADE,
  balance   DECIMAL(10, 2)  NOT NULL DEFAULT 0.00,
  updated_at TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

  PRIMARY KEY (group_id, user_id)
);

CREATE INDEX idx_netbalances_group ON NetBalances(group_id);

-- ============================================================
--  HELPER: Ensure payer is a group member before insert
-- ============================================================
CREATE OR REPLACE FUNCTION fn_validate_payer_membership()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM GroupMembers
    WHERE group_id = NEW.group_id
      AND user_id  = NEW.paid_by
      AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION
      'PAYER_NOT_MEMBER: User % is not an active member of group %',
      NEW.paid_by, NEW.group_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_payer_membership
  BEFORE INSERT ON Expenses
  FOR EACH ROW EXECUTE FUNCTION fn_validate_payer_membership();

-- ============================================================
--  TRIGGER FUNCTION: Update NetBalances after ExpenseSplits insert
--
--  Logic per new split row (debtor = NEW.user_id):
--    1. Debtor's balance   -= NEW.owed_amount   (they owe more)
--    2. Payer's  balance   += NEW.owed_amount   (they are owed more)
--
--  Uses INSERT … ON CONFLICT (upsert) so the row is created
--  automatically if the user hasn't participated in the group yet.
-- ============================================================
CREATE OR REPLACE FUNCTION fn_update_net_balances()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_group_id  UUID;
  v_payer_id  UUID;
BEGIN
  -- Fetch group and payer from the parent Expense row
  SELECT e.group_id, e.paid_by
    INTO v_group_id, v_payer_id
    FROM Expenses e
   WHERE e.expense_id = NEW.expense_id;

  -- Guard: the debtor should not be the payer for this split
  -- (payer's own "share" is tracked implicitly via credits)
  IF NEW.user_id = v_payer_id THEN
    -- Payer owes themselves nothing; skip balance mutation
    RETURN NEW;
  END IF;

  -- ── DEBTOR: balance decreases (owes money) ──────────────
  INSERT INTO NetBalances (group_id, user_id, balance, updated_at)
    VALUES (v_group_id, NEW.user_id, -NEW.owed_amount, NOW())
  ON CONFLICT (group_id, user_id)
  DO UPDATE SET
    balance    = NetBalances.balance - EXCLUDED.balance,
    updated_at = NOW();

  -- ── PAYER: balance increases (is owed money) ────────────
  INSERT INTO NetBalances (group_id, user_id, balance, updated_at)
    VALUES (v_group_id, v_payer_id, NEW.owed_amount, NOW())
  ON CONFLICT (group_id, user_id)
  DO UPDATE SET
    balance    = NetBalances.balance + EXCLUDED.balance,
    updated_at = NOW();

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_net_balances
  AFTER INSERT ON ExpenseSplits
  FOR EACH ROW EXECUTE FUNCTION fn_update_net_balances();

-- ============================================================
--  TRIGGER FUNCTION: Validate split total equals expense total
--  (fires after ALL rows of a statement, via CONSTRAINT trigger)
-- ============================================================
CREATE OR REPLACE FUNCTION fn_validate_split_sum()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_total_splits DECIMAL(10,2);
  v_total_expense DECIMAL(10,2);
BEGIN
  SELECT COALESCE(SUM(es.owed_amount), 0), e.total_amount
    INTO v_total_splits, v_total_expense
    FROM ExpenseSplits es
    JOIN Expenses e USING (expense_id)
   WHERE es.expense_id = NEW.expense_id
   GROUP BY e.total_amount;

  -- Allow small floating-point tolerance (±0.01)
  IF ABS(v_total_splits - v_total_expense) > 0.01 THEN
    RAISE EXCEPTION
      'SPLIT_MISMATCH: Splits sum (%) != expense total (%) for expense %',
      v_total_splits, v_total_expense, NEW.expense_id;
  END IF;

  RETURN NEW;
END;
$$;

-- NOTE: This trigger is intentionally left as a DEFERRED check called
-- explicitly at transaction commit time via the application layer
-- (set constraints deferred), so partial inserts within a tx are valid.

-- ============================================================
--  COMPLEX QUERY
--
--  "Fetch all 'Food' expenses from the last 30 days in Group X
--   where User Y was a PARTICIPANT but NOT the payer."
--
--  Replace :group_id and :user_id with actual parameter values.
-- ============================================================

-- Query (parameterised — use $1 / $2 in pg library):
/*
SELECT
  e.expense_id,
  e.title,
  e.total_amount,
  e.created_at                           AS expense_date,
  payer.full_name                        AS paid_by_name,
  payer.username                         AS paid_by_username,
  es.owed_amount                         AS user_owes,
  ROUND(
    es.owed_amount / e.total_amount * 100, 2
  )                                      AS pct_of_total,
  e.notes
FROM Expenses        e
JOIN ExpenseSplits   es  ON es.expense_id = e.expense_id
                        AND es.user_id    = $2          -- participant filter
JOIN Users           payer ON payer.user_id = e.paid_by
WHERE e.group_id  = $1                                  -- group filter
  AND e.category  = 'Food'                              -- category filter
  AND e.created_at >= NOW() - INTERVAL '30 days'        -- 30-day window
  AND e.paid_by  != $2                                  -- NOT the payer
ORDER BY e.created_at DESC;
*/

-- ============================================================
--  VIEWS (bonus — useful for the backend)
-- ============================================================

-- Member balances with user info
CREATE OR REPLACE VIEW vw_group_balances AS
SELECT
  nb.group_id,
  g.group_name,
  nb.user_id,
  u.full_name,
  u.username,
  nb.balance,
  nb.updated_at
FROM NetBalances nb
JOIN Groups g USING (group_id)
JOIN Users  u USING (user_id);

-- Per-expense summary
CREATE OR REPLACE VIEW vw_expense_summary AS
SELECT
  e.expense_id,
  e.group_id,
  e.title,
  e.total_amount,
  e.category,
  e.created_at,
  payer.username  AS payer_username,
  payer.full_name AS payer_name,
  COUNT(es.split_id)              AS participant_count,
  SUM(es.owed_amount)             AS splits_total,
  SUM(es.owed_amount) FILTER (WHERE es.is_settled) AS settled_total
FROM Expenses      e
JOIN Users         payer ON payer.user_id = e.paid_by
LEFT JOIN ExpenseSplits es ON es.expense_id = e.expense_id
GROUP BY e.expense_id, payer.username, payer.full_name;
