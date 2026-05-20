-- ══════════════════════════════════════════════════════════════
-- EBP Trading Dashboard — Supabase Schema
-- Run this in: supabase.com/dashboard/project/nqyymmwkrupzwvhbmmaf/sql/new
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS trades (
  id                BIGSERIAL PRIMARY KEY,
  pair              TEXT NOT NULL,
  direction         TEXT NOT NULL CHECK (direction IN ('BUY', 'SELL')),
  account_num       INTEGER NOT NULL CHECK (account_num IN (1, 2, 3)),
  entry_price       NUMERIC(18,6) NOT NULL,
  sl_price          NUMERIC(18,6) NOT NULL,
  tp_price          NUMERIC(18,6) NOT NULL,
  lots              NUMERIC(10,4),
  risk_usd          NUMERIC(10,2),
  signal_time       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status            TEXT NOT NULL DEFAULT 'PENDING' CHECK (
                      status IN ('PENDING','FILLED','NOT_TAKEN','INVALIDATED','WIN','LOSS','BE_ACTIVE')
                    ),
  fill_time         TIMESTAMPTZ,
  be_time           TIMESTAMPTZ,
  outcome_time      TIMESTAMPTZ,
  pnl_r             NUMERIC(8,2),
  pnl_usd           NUMERIC(10,2),
  manually_excluded BOOLEAN NOT NULL DEFAULT FALSE,
  notes             TEXT,
  raw_message       TEXT
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_trades_signal_time  ON trades (signal_time DESC);
CREATE INDEX IF NOT EXISTS idx_trades_pair         ON trades (pair);
CREATE INDEX IF NOT EXISTS idx_trades_status       ON trades (status);
CREATE INDEX IF NOT EXISTS idx_trades_account_num  ON trades (account_num);

-- Enable Row Level Security
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS automatically.
-- Allow anon key to read (for direct Supabase JS client if ever used).
CREATE POLICY "anon_select" ON trades FOR SELECT TO anon USING (true);
