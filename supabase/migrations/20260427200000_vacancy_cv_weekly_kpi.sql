BEGIN;

CREATE TABLE IF NOT EXISTS public.vacancy_cv_weekly_kpi (
  vacancy_id text NOT NULL,
  week_start date NOT NULL,
  candidate_count integer NOT NULL DEFAULT 0,
  synced_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (vacancy_id, week_start),
  CONSTRAINT vacancy_cv_weekly_kpi_candidate_count_non_negative CHECK (candidate_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_vacancy_cv_weekly_kpi_week_start
  ON public.vacancy_cv_weekly_kpi (week_start);

ALTER TABLE public.vacancy_cv_weekly_kpi ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'vacancy_cv_weekly_kpi'
      AND policyname = 'Allow authenticated read'
  ) THEN
    CREATE POLICY "Allow authenticated read"
      ON public.vacancy_cv_weekly_kpi
      FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;
END $$;

COMMIT;
