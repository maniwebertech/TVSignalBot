-- ══════════════════════════════════════════════════════════════
-- Smart Money AI Dashboard — Supabase Schema
-- Run in: supabase.com/dashboard/project/nqyymmwkrupzwvhbmmaf/sql/new
-- ══════════════════════════════════════════════════════════════

-- Clean slate: drop old table
DROP TABLE IF EXISTS trades CASCADE;

-- ── Trades table ─────────────────────────────────────────────
CREATE TABLE trades (
  id            BIGSERIAL PRIMARY KEY,
  ticker        TEXT NOT NULL,
  direction     TEXT NOT NULL CHECK (direction IN ('LONG', 'SHORT')),
  entry_price   NUMERIC(18,6),
  sl_price      NUMERIC(18,6),
  tp1_price     NUMERIC(18,6),
  tp2_price     NUMERIC(18,6),
  lots          NUMERIC(10,4),
  risk_usd      NUMERIC(10,2) DEFAULT 50,
  quality       TEXT,
  htf_bias      TEXT,
  mtf_stack     TEXT,
  setup_mode    TEXT,
  exec_mode     TEXT,
  signal_time   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status        TEXT NOT NULL DEFAULT 'TRIGGERED' CHECK (
                  status IN ('TRIGGERED','FILLED','BE_ACTIVE','TP2_HIT','SL_HIT','BE_EXIT','CANCELLED')
                ),
  fill_time     TIMESTAMPTZ,
  be_time       TIMESTAMPTZ,
  outcome_time  TIMESTAMPTZ,
  pnl_r         NUMERIC(8,2),
  pnl_usd       NUMERIC(10,2),
  notes         TEXT,
  raw_message   TEXT
);

-- Indexes
CREATE INDEX idx_trades_signal_time ON trades (signal_time DESC);
CREATE INDEX idx_trades_ticker      ON trades (ticker);
CREATE INDEX idx_trades_status      ON trades (status);
CREATE INDEX idx_trades_direction   ON trades (direction);

-- Row Level Security
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_select" ON trades FOR SELECT TO anon USING (true);
