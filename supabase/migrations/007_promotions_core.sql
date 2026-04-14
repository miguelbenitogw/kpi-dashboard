-- Migration 007: Core promotions table - the nucleus of the system
-- Everything connects to promotions: candidates, targets, sheets, history.

CREATE TABLE IF NOT EXISTS promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL UNIQUE,           -- "Promoción 113"
  numero int,                            -- 113
  modalidad text,                        -- Online / Semi / Presencial
  pais text,                             -- España / Italia / Francia
  coordinador text,
  cliente text,
  fecha_inicio date,
  fecha_fin date,
  -- Targets (from promo_targets / Excel madre Resumen)
  objetivo_atraccion int,
  objetivo_programa int,
  expectativa_finalizan int,
  -- Calculated/synced counts
  total_aceptados int DEFAULT 0,
  total_programa int DEFAULT 0,
  total_hired int DEFAULT 0,
  total_dropouts int DEFAULT 0,
  total_candidates int DEFAULT 0,
  -- Linked resources
  zoho_job_opening_id text,              -- link to job_openings table
  sheet_url text,                        -- per-promo Google Sheet URL
  sheet_madre_row int,                   -- row number in Excel madre
  -- Status
  is_active boolean DEFAULT true,
  phase text DEFAULT 'formacion',        -- inicio / avanzada / busqueda / final / completada
  -- Metadata
  raw_data jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS promotions_nombre_idx ON promotions(nombre);
CREATE INDEX IF NOT EXISTS promotions_numero_idx ON promotions(numero);
CREATE INDEX IF NOT EXISTS promotions_active_idx ON promotions(is_active) WHERE is_active = true;

ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read" ON promotions FOR SELECT USING (true);

-- Add placement_status to candidates (from Global Placement tab)
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS placement_status text;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS placement_client text;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS placement_location text;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS placement_date date;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS flight_date date;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS hospitering_dates text;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS hpr_number text;

-- Link candidates to promotions
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS promotion_id uuid REFERENCES promotions(id);
CREATE INDEX IF NOT EXISTS candidates_promotion_idx ON candidates(promotion_id) WHERE promotion_id IS NOT NULL;
