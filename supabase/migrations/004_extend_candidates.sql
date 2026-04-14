-- Migration 004: Extend candidates with Excel madre + dropout fields
-- Unifies all candidate data in a single table

-- Fields from Excel madre "Base Datos" tab
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS coordinador text;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS tipo_perfil text;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS cliente text;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS fecha_fin_formacion date;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS fecha_inicio_trabajo date;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS tiempo_colocacion text;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS notas_excel text;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS promocion_nombre text;

-- Fields from per-promo Excel dropouts tab
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS dropout_reason text;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS dropout_date date;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS dropout_notes text;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS dropout_attendance_pct numeric(5,2);
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS dropout_language_level text;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS transferred_to text;

-- Index for filtering by promo name
CREATE INDEX IF NOT EXISTS candidates_promocion_nombre_idx ON candidates (promocion_nombre) WHERE promocion_nombre IS NOT NULL;

-- Index for dropout queries
CREATE INDEX IF NOT EXISTS candidates_dropout_reason_idx ON candidates (dropout_reason) WHERE dropout_reason IS NOT NULL;
