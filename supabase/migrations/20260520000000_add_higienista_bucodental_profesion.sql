-- Migration: add higienista_bucodental to derive_profesion_tipo
--
-- Adds "higienista|bucodental" pattern before the ELSE fallback.
-- Must stay in sync with deriveProfesionTipo() in src/lib/utils/vacancy-profession.ts.

BEGIN;

-- ── 1. Update function with new profession ─────────────────────────────────────
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
      WHEN lower(title) ~ '(veterina)'
        THEN 'veterinario'
      WHEN lower(title) ~ '(higienista|bucodental)'
        THEN 'higienista_bucodental'
      ELSE 'otro'
    END
$$;

-- ── 2. Update CHECK constraint to allow new value ───────────────────────────────
ALTER TABLE public.job_openings_kpi DROP CONSTRAINT IF EXISTS job_openings_tipo_profesional_check;
ALTER TABLE public.job_openings_kpi ADD CONSTRAINT job_openings_tipo_profesional_check
  CHECK (tipo_profesional = ANY (ARRAY[
    'enfermero', 'auxiliar_enfermeria', 'medico', 'fisioterapeuta',
    'maestro_primaria', 'maestro_infantil', 'farmaceutico', 'ingeniero',
    'electricista', 'conductor', 'veterinario', 'higienista_bucodental', 'otro'
  ]));

-- ── 3. Re-derive ALL rows to pick up new classification ─────────────────────────
UPDATE public.job_openings_kpi
SET    tipo_profesional = public.derive_profesion_tipo(title)
WHERE  title IS NOT NULL;

COMMIT;
