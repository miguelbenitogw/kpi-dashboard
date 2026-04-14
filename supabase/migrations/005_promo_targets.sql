-- Migration 005: Promo targets (aggregate objectives per promo)
-- Imported from Excel madre "Resumen" tab

CREATE TABLE IF NOT EXISTS promo_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promocion text NOT NULL UNIQUE,
  modalidad text,
  pais text,
  coordinador text,
  cliente text,
  fecha_inicio date,
  fecha_fin date,
  objetivo_atraccion int,
  total_aceptados int,
  pct_consecucion_atraccion numeric(5,2),
  objetivo_programa int,
  total_programa int,
  pct_consecucion_programa numeric(5,2),
  expectativa_finalizan int,
  pct_exito_estimado numeric(5,2),
  contratos_firmados int,
  raw_data jsonb,
  last_synced_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS promo_targets_promocion_idx ON promo_targets (promocion);

-- RLS
ALTER TABLE promo_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read" ON promo_targets FOR SELECT USING (true);
