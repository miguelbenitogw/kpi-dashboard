-- Migration: vacancy_cv_historical_sync
--
-- Purpose: support the /api/admin/sync-vacancy-cvs-historical endpoint, which
-- backfills weekly CV counts for ALL vacancies (including closed ones) into
-- vacancy_cv_weekly_kpi.
--
-- This migration:
--   1. Documents the table purpose via COMMENT ON TABLE.
--   2. Ensures the service-role upsert path is unblocked — the existing RLS
--      setup already grants service_role bypass via Supabase defaults, so no
--      additional write policy is needed. Only a defensive SELECT policy is
--      added here (idempotent) in case a fresh env ran this migration before
--      the broader 20260427173000_secure_authenticated_reads migration.
--
-- Writes go through supabaseAdmin (SUPABASE_SERVICE_ROLE_KEY), which bypasses
-- RLS entirely. No INSERT/UPDATE/DELETE policy is required.

BEGIN;

-- Document table purpose
COMMENT ON TABLE public.vacancy_cv_weekly_kpi IS
  'Stores weekly CV-received counts per vacancy, keyed by (vacancy_id, week_start). '
  'Week start is always the Monday of the ISO work week (Mon–Fri; weekend submissions '
  'are attributed to the preceding Friday''s week). '
  'Populated by the sync-vacancy-cvs (active) and sync-vacancy-cvs-historical (all/inactive) '
  'admin endpoints via the Zoho Recruit API. Upserts are performed by the service role; '
  'authenticated users have SELECT access.';

-- Defensive: add authenticated-read policy only if it doesn''t already exist.
-- The broader 20260427173000 migration creates this for all *_kpi tables, but
-- running migrations in isolation (e.g. CI) should still work.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'vacancy_cv_weekly_kpi'
      AND policyname = 'Allow authenticated read'
  ) THEN
    CREATE POLICY "Allow authenticated read"
      ON public.vacancy_cv_weekly_kpi
      FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;
END $$;

COMMIT;
