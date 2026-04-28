-- Migration: tipo_profesional_derivation
--
-- Purpose: derive the professional type (tipo_profesional) of a job opening
-- from its title using keyword matching, keeping it in sync with the
-- TypeScript utility src/lib/utils/vacancy-profession.ts.
--
-- This migration:
--   1. Creates the IMMUTABLE function derive_profesion_tipo(title text).
--   2. Backfills ALL rows in job_openings_kpi.
--   3. Adds a BEFORE INSERT OR UPDATE trigger so future Zoho syncs auto-derive.
--
-- Order of CASE branches matters — more specific patterns come first.
-- Accent-insensitive via regex character classes (no unaccent extension needed).
-- Must stay in sync with deriveProfesionTipo() in vacancy-profession.ts.

BEGIN;

-- ── 1. Function ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.derive_profesion_tipo(title text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    CASE
      WHEN title IS NULL THEN 'otro'
      WHEN lower(title) ~ '(enferm|infermier|infirmier|nurs|enfermeiro|sjukepleier)'
        THEN 'enfermero'
      WHEN lower(title) ~ '(auxiliar|tapsd|cuidador|gerocult)'
        THEN 'auxiliar_enfermeria'
      WHEN lower(title) ~ '(m[eé]dic|doctor|physician|lege)'
        THEN 'medico'
      WHEN lower(title) ~ '(fisioterap|physiother)'
        THEN 'fisioterapeuta'
      WHEN lower(title) ~ '(primaria|primary)'
        THEN 'maestro_primaria'
      WHEN lower(title) ~ '(infantil|educador)'
        THEN 'maestro_infantil'
      WHEN lower(title) ~ '(farmac[eé]ut|pharma)'
        THEN 'farmaceutico'
      WHEN lower(title) ~ '(ingenier|engineer)'
        THEN 'ingeniero'
      WHEN lower(title) ~ '(electric)'
        THEN 'electricista'
      WHEN lower(title) ~ '(conductor|driver|chauf)'
        THEN 'conductor'
      ELSE 'otro'
    END
$$;

COMMENT ON FUNCTION public.derive_profesion_tipo(text) IS
  'Derives tipo_profesional from a job opening title. '
  'IMMUTABLE — result depends only on input. '
  'Must stay in sync with deriveProfesionTipo() in src/lib/utils/vacancy-profession.ts. '
  'Order of CASE branches matters (more specific first).';

-- ── 2. Backfill ALL rows ────────────────────────────────────────────────────────
UPDATE public.job_openings_kpi
SET    tipo_profesional = public.derive_profesion_tipo(title)
WHERE  title IS NOT NULL;

-- ── 3. Trigger — auto-derive on every INSERT / UPDATE ─────────────────────────
CREATE OR REPLACE FUNCTION public.set_job_opening_tipo_profesional()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.tipo_profesional := public.derive_profesion_tipo(NEW.title);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_tipo_profesional ON public.job_openings_kpi;

CREATE TRIGGER trg_set_tipo_profesional
  BEFORE INSERT OR UPDATE OF title ON public.job_openings_kpi
  FOR EACH ROW
  EXECUTE FUNCTION public.set_job_opening_tipo_profesional();

COMMIT;
