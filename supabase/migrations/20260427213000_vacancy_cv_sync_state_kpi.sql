BEGIN;

CREATE TABLE IF NOT EXISTS public.vacancy_cv_sync_state_kpi (
  vacancy_id text PRIMARY KEY REFERENCES public.job_openings_kpi (id) ON DELETE CASCADE,
  last_sync_at timestamptz NOT NULL DEFAULT now(),
  last_total_candidates integer NOT NULL DEFAULT 0 CHECK (last_total_candidates >= 0),
  status text NOT NULL DEFAULT 'synced' CHECK (status IN ('synced', 'skipped_unchanged', 'error')),
  last_error text NULL,
  last_duration_ms integer NOT NULL DEFAULT 0 CHECK (last_duration_ms >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vacancy_cv_sync_state_kpi_last_sync_at
  ON public.vacancy_cv_sync_state_kpi (last_sync_at DESC);

ALTER TABLE public.vacancy_cv_sync_state_kpi ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'vacancy_cv_sync_state_kpi'
      AND policyname = 'Allow authenticated read sync state'
  ) THEN
    CREATE POLICY "Allow authenticated read sync state"
      ON public.vacancy_cv_sync_state_kpi
      FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;
END $$;

COMMIT;
