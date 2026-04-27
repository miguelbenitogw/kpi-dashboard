-- Harden all *_kpi tables in public schema.
-- Goal:
-- 1) Never allow anonymous read on sensitive KPI data.
-- 2) Keep service-role backend writes unaffected.
-- 3) Apply user-scoped policies where ownership columns exist.
--
-- Notes:
-- - This migration is idempotent.
-- - It tolerates missing tables (different envs can drift).

BEGIN;

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename LIKE '%\_kpi' ESCAPE '\'
  LOOP
    -- Ensure RLS is enabled for every *_kpi table
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    -- Cleanup legacy broad policies
    EXECUTE format('DROP POLICY IF EXISTS "Allow public read" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Allow authenticated read" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Owner read access" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Owner write access" ON public.%I', t);
  END LOOP;
END $$;

-- ============================================================
-- Sensitive config/token tables: service role only (no SELECT policy)
-- ============================================================

DO $$
BEGIN
  IF to_regclass('public.dashboard_config_kpi') IS NOT NULL THEN
    ALTER TABLE public.dashboard_config_kpi ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Allow public read" ON public.dashboard_config_kpi;
    DROP POLICY IF EXISTS "Allow authenticated read" ON public.dashboard_config_kpi;
    DROP POLICY IF EXISTS "Owner read access" ON public.dashboard_config_kpi;
    DROP POLICY IF EXISTS "Owner write access" ON public.dashboard_config_kpi;
  END IF;

  IF to_regclass('public.user_openai_keys_kpi') IS NOT NULL THEN
    ALTER TABLE public.user_openai_keys_kpi ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Allow public read" ON public.user_openai_keys_kpi;
    DROP POLICY IF EXISTS "Allow authenticated read" ON public.user_openai_keys_kpi;
    DROP POLICY IF EXISTS "Owner read access" ON public.user_openai_keys_kpi;
    DROP POLICY IF EXISTS "Owner write access" ON public.user_openai_keys_kpi;
  END IF;
END $$;

-- ============================================================
-- User-scoped tables (owner by email)
-- ============================================================

DO $$
BEGIN
  IF to_regclass('public.ai_alerts_kpi') IS NOT NULL THEN
    CREATE POLICY "Owner read access"
      ON public.ai_alerts_kpi
      FOR SELECT
      USING (lower(user_email) = lower(auth.email()));
  END IF;

  IF to_regclass('public.ai_alert_events_kpi') IS NOT NULL THEN
    CREATE POLICY "Owner read access"
      ON public.ai_alert_events_kpi
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.ai_alerts_kpi a
          WHERE a.id = ai_alert_events_kpi.alert_id
            AND lower(a.user_email) = lower(auth.email())
        )
      );
  END IF;

  IF to_regclass('public.chat_sessions_kpi') IS NOT NULL THEN
    CREATE POLICY "Owner read access"
      ON public.chat_sessions_kpi
      FOR SELECT
      USING (lower(user_email) = lower(auth.email()));
  END IF;

  IF to_regclass('public.chat_messages_kpi') IS NOT NULL THEN
    CREATE POLICY "Owner read access"
      ON public.chat_messages_kpi
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.chat_sessions_kpi s
          WHERE s.id = chat_messages_kpi.session_id
            AND lower(s.user_email) = lower(auth.email())
        )
      );
  END IF;
END $$;

-- ============================================================
-- General KPI tables: authenticated read
-- (applies to all *_kpi except special cases above)
-- ============================================================

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename LIKE '%\_kpi' ESCAPE '\'
      AND tablename NOT IN (
        'dashboard_config_kpi',
        'user_openai_keys_kpi',
        'ai_alerts_kpi',
        'ai_alert_events_kpi',
        'chat_sessions_kpi',
        'chat_messages_kpi'
      )
  LOOP
    EXECUTE format(
      'CREATE POLICY "Allow authenticated read" ON public.%I FOR SELECT USING (auth.role() = ''authenticated'')',
      t
    );
  END LOOP;
END $$;

COMMIT;
