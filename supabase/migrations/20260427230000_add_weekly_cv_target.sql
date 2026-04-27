BEGIN;

ALTER TABLE public.job_openings_kpi
  ADD COLUMN IF NOT EXISTS weekly_cv_target integer;

ALTER TABLE public.job_openings_kpi
  DROP CONSTRAINT IF EXISTS job_openings_kpi_weekly_cv_target_non_negative;

ALTER TABLE public.job_openings_kpi
  ADD CONSTRAINT job_openings_kpi_weekly_cv_target_non_negative
  CHECK (weekly_cv_target IS NULL OR weekly_cv_target >= 0);

COMMIT;
