-- Migration 015: job_openings enrichment
-- Rename formacion→rendimiento, add tipo_profesional, tags, Zoho description

BEGIN;

-- 1. Rename category value 'formacion' → 'rendimiento'
ALTER TABLE job_openings DROP CONSTRAINT IF EXISTS job_openings_category_check;
UPDATE job_openings SET category = 'rendimiento' WHERE category = 'formacion';
ALTER TABLE job_openings
  ADD CONSTRAINT job_openings_category_check
  CHECK (category IN ('atraccion', 'rendimiento', 'interna'));

-- 2. Tipo de profesional reclutado (editable manually; auto-filled later by agent)
ALTER TABLE job_openings
  ADD COLUMN IF NOT EXISTS tipo_profesional text NOT NULL DEFAULT 'otro';
ALTER TABLE job_openings
  ADD CONSTRAINT job_openings_tipo_profesional_check
  CHECK (tipo_profesional IN (
    'enfermero', 'fisioterapeuta',
    'maestro_infantil', 'maestro_primaria',
    'medico', 'otro'
  ));
COMMENT ON COLUMN job_openings.tipo_profesional IS
  'Tipo de profesional reclutado. Editable manualmente; se puede inferir del nombre.';

-- 3. Tags de Zoho (e.g. ["Proceso Atracción Actual"])
ALTER TABLE job_openings
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

-- 4. Flag derivado del tag "Proceso Atracción Actual"
ALTER TABLE job_openings
  ADD COLUMN IF NOT EXISTS es_proceso_atraccion_actual boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN job_openings.es_proceso_atraccion_actual IS
  'true cuando la vacante tiene el tag "Proceso Atracción Actual" en Zoho Recruit.';

-- 5. Descripción de la vacante (desde Zoho Job_Description)
ALTER TABLE job_openings
  ADD COLUMN IF NOT EXISTS job_description text;

-- 6. Índices
CREATE INDEX IF NOT EXISTS job_openings_tipo_idx
  ON job_openings (tipo_profesional);
CREATE INDEX IF NOT EXISTS job_openings_proceso_atraccion_idx
  ON job_openings (es_proceso_atraccion_actual) WHERE es_proceso_atraccion_actual = true;
CREATE INDEX IF NOT EXISTS job_openings_category_status_idx
  ON job_openings (category, status);

COMMIT;
