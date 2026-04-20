-- Migration 017: Social Media snapshots schema
-- Enhances the social_media_snapshots_kpi stub created in 008 + renamed in 016
-- with per-account detail columns needed for the RRSS integration.

BEGIN;

-- Add detail columns to the existing stub table (already renamed to _kpi in 016)
ALTER TABLE social_media_snapshots_kpi
  ADD COLUMN IF NOT EXISTS account_id       text,
  ADD COLUMN IF NOT EXISTS handle           text,
  ADD COLUMN IF NOT EXISTS followers_count  int,
  ADD COLUMN IF NOT EXISTS following_count  int,
  ADD COLUMN IF NOT EXISTS posts_count      int,
  ADD COLUMN IF NOT EXISTS total_views      bigint,
  ADD COLUMN IF NOT EXISTS subscribers_count int,
  ADD COLUMN IF NOT EXISTS raw_data         jsonb;

-- Fallback: if the table was never created (pure stub path), create it in full
CREATE TABLE IF NOT EXISTS social_media_snapshots_kpi (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id        text        NOT NULL,
  platform          text        NOT NULL,
  handle            text,
  metric_name       text        NOT NULL DEFAULT 'snapshot',
  followers_count   int,
  following_count   int,
  posts_count       int,
  total_views       bigint,
  subscribers_count int,
  raw_data          jsonb,
  captured_at       timestamptz DEFAULT now()
);

-- Enable RLS (idempotent)
ALTER TABLE social_media_snapshots_kpi ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'social_media_snapshots_kpi'
      AND policyname = 'Allow public read'
  ) THEN
    CREATE POLICY "Allow public read"
      ON social_media_snapshots_kpi FOR SELECT USING (true);
  END IF;
END $$;

-- Composite index: latest snapshot per account
CREATE INDEX IF NOT EXISTS social_media_snapshots_kpi_account_captured_idx
  ON social_media_snapshots_kpi (account_id, captured_at DESC);

-- Platform-wide queries (e.g. "all YouTube snapshots")
CREATE INDEX IF NOT EXISTS social_media_snapshots_kpi_platform_idx
  ON social_media_snapshots_kpi (platform, captured_at DESC);

COMMENT ON TABLE social_media_snapshots_kpi IS
  'Per-account social media snapshots. YouTube populated via API; '
  'other platforms require manual entry (metric_name = ''manual'').';

COMMIT;
