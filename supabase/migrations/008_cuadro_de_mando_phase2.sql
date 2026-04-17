-- Migration 008: Cuadro de Mando Phase 2
-- Adds charlas/webinar tracking, GA4 URL mapping, contact forms,
-- and STUB tables for RRSS, billing, costs, and event targets.
-- Also extends promotions and candidates with new columns.

-- ============================================================
-- 1. charlas_registros — individual charla/webinar records from CSV
-- ============================================================
CREATE TABLE IF NOT EXISTS charlas_registros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  temporada text NOT NULL,
  programa text,
  promocion text,
  modalidad text,                          -- Presencial / Online / Semipresencial
  anio int,
  n_personas int,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS charlas_registros_temporada_idx ON charlas_registros(temporada);
CREATE INDEX IF NOT EXISTS charlas_registros_programa_idx ON charlas_registros(programa);

ALTER TABLE charlas_registros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read" ON charlas_registros FOR SELECT USING (true);

-- ============================================================
-- 2. charlas_temporada_summary — aggregated per season
-- ============================================================
CREATE TABLE IF NOT EXISTS charlas_temporada_summary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  temporada text NOT NULL,
  programa text,
  total_inscritos_charlas int,
  total_inscritos_webinars int,
  total_charlas_realizadas int,
  total_webinars_realizados int,
  personas_de_uni int,
  personas_de_webinar int,
  total_en_formacion int,
  observaciones text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (temporada, programa)
);

ALTER TABLE charlas_temporada_summary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read" ON charlas_temporada_summary FOR SELECT USING (true);

-- ============================================================
-- 3. profession_url_mapping — maps URL paths to professions for GA4
-- ============================================================
CREATE TABLE IF NOT EXISTS profession_url_mapping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profession text NOT NULL UNIQUE,
  url_pattern text NOT NULL,
  regex_pattern text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profession_url_mapping ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read" ON profession_url_mapping FOR SELECT USING (true);

-- ============================================================
-- 4. contact_form_submissions — webhook from contact forms
-- ============================================================
CREATE TABLE IF NOT EXISTS contact_form_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  phone text,
  name text,
  profession text,
  message text,
  source_url text,
  submitted_at timestamptz DEFAULT now(),
  zoho_lead_id text
);

CREATE INDEX IF NOT EXISTS contact_form_submissions_submitted_at_idx ON contact_form_submissions(submitted_at);

ALTER TABLE contact_form_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read" ON contact_form_submissions FOR SELECT USING (true);

-- ============================================================
-- 5. social_media_snapshots — STUB for future RRSS integration
-- ============================================================
CREATE TABLE IF NOT EXISTS social_media_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL,
  metric_name text NOT NULL DEFAULT 'followers',
  metric_value int,
  captured_at timestamptz DEFAULT now()
);

COMMENT ON TABLE social_media_snapshots IS 'STUB: future integration with social media APIs (Instagram, LinkedIn, etc.)';

CREATE INDEX IF NOT EXISTS social_media_snapshots_platform_captured_idx ON social_media_snapshots(platform, captured_at);

ALTER TABLE social_media_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read" ON social_media_snapshots FOR SELECT USING (true);

-- ============================================================
-- 6. placement_billing — STUB for future facturación (Google Sheet manual)
-- ============================================================
CREATE TABLE IF NOT EXISTS placement_billing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid REFERENCES promotions(id),
  client_name text,
  billing_status text NOT NULL CHECK (billing_status IN ('cobrado_total', 'cobrado_parcial', 'no_cobrado')),
  people_count int DEFAULT 0,
  amount_eur numeric(12,2) DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE placement_billing IS 'STUB: future facturación tracking from Google Sheet manual input';

CREATE INDEX IF NOT EXISTS placement_billing_promotion_idx ON placement_billing(promotion_id);

ALTER TABLE placement_billing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read" ON placement_billing FOR SELECT USING (true);

-- ============================================================
-- 7. project_costs — STUB for future costes/margen
-- ============================================================
CREATE TABLE IF NOT EXISTS project_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid REFERENCES promotions(id),
  category text NOT NULL CHECK (category IN ('personal', 'publicidad', 'portales', 'zoom', 'training', 'otros')),
  amount_eur numeric(12,2),
  cost_month int,
  cost_year int,
  description text,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE project_costs IS 'STUB: future cost/margin tracking per promotion';

CREATE INDEX IF NOT EXISTS project_costs_promotion_category_idx ON project_costs(promotion_id, category);

ALTER TABLE project_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read" ON project_costs FOR SELECT USING (true);

-- ============================================================
-- 8. event_targets — STUB for future institutional event objectives
-- ============================================================
CREATE TABLE IF NOT EXISTS event_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  temporada text NOT NULL,
  programa text,
  target_events_presencial int,
  target_events_online int,
  target_total int,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE event_targets IS 'STUB: future institutional event target tracking per season';

ALTER TABLE event_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read" ON event_targets FOR SELECT USING (true);

-- ============================================================
-- 9. Extend promotions — add season column
-- ============================================================
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS season text;  -- e.g. "2025-2026"

-- ============================================================
-- 10. Extend candidates — add placement_preference
-- ============================================================
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS placement_preference text;
-- Values: Kommuner, Vikar, Vikar_Kommuner, No_feedback, Training_Vikar, Training_Kommuner_Fast
