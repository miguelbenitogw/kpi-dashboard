-- Migration 018: RLS + public read policies for all KPI tables
--
-- All tables owned by the KPI dashboard need public SELECT access so the
-- client-side Supabase anon key can read them from the browser.
-- Write operations (INSERT/UPDATE/DELETE) are only done via supabaseAdmin
-- (service-role key, bypasses RLS) from API routes — no write policies needed.
--
-- Tables that already had policies before the _kpi rename are included here
-- with IF NOT EXISTS guards so this is fully idempotent.

BEGIN;

-- ============================================================
-- Core data tables
-- ============================================================

ALTER TABLE candidates_kpi ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read" ON candidates_kpi;
CREATE POLICY "Allow public read" ON candidates_kpi FOR SELECT USING (true);

ALTER TABLE job_openings_kpi ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read" ON job_openings_kpi;
CREATE POLICY "Allow public read" ON job_openings_kpi FOR SELECT USING (true);

ALTER TABLE candidate_job_history_kpi ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read" ON candidate_job_history_kpi;
CREATE POLICY "Allow public read" ON candidate_job_history_kpi FOR SELECT USING (true);

-- ============================================================
-- SLA / snapshot tables
-- ============================================================

ALTER TABLE sla_alerts_kpi ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read" ON sla_alerts_kpi;
CREATE POLICY "Allow public read" ON sla_alerts_kpi FOR SELECT USING (true);

ALTER TABLE daily_snapshot_kpi ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read" ON daily_snapshot_kpi;
CREATE POLICY "Allow public read" ON daily_snapshot_kpi FOR SELECT USING (true);

ALTER TABLE stage_history_kpi ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read" ON stage_history_kpi;
CREATE POLICY "Allow public read" ON stage_history_kpi FOR SELECT USING (true);

ALTER TABLE sync_log_kpi ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read" ON sync_log_kpi;
CREATE POLICY "Allow public read" ON sync_log_kpi FOR SELECT USING (true);

-- ============================================================
-- Promo tables
-- ============================================================

ALTER TABLE promo_sheets_kpi ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read" ON promo_sheets_kpi;
CREATE POLICY "Allow public read" ON promo_sheets_kpi FOR SELECT USING (true);

ALTER TABLE promo_targets_kpi ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read" ON promo_targets_kpi;
CREATE POLICY "Allow public read" ON promo_targets_kpi FOR SELECT USING (true);

ALTER TABLE promo_students_kpi ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read" ON promo_students_kpi;
CREATE POLICY "Allow public read" ON promo_students_kpi FOR SELECT USING (true);

ALTER TABLE promo_job_link_kpi ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read" ON promo_job_link_kpi;
CREATE POLICY "Allow public read" ON promo_job_link_kpi FOR SELECT USING (true);

ALTER TABLE promotions_kpi ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read" ON promotions_kpi;
CREATE POLICY "Allow public read" ON promotions_kpi FOR SELECT USING (true);

-- ============================================================
-- Charlas / event tables
-- ============================================================

ALTER TABLE charlas_registros_kpi ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read" ON charlas_registros_kpi;
CREATE POLICY "Allow public read" ON charlas_registros_kpi FOR SELECT USING (true);

ALTER TABLE charlas_temporada_kpi ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read" ON charlas_temporada_kpi;
CREATE POLICY "Allow public read" ON charlas_temporada_kpi FOR SELECT USING (true);

ALTER TABLE charlas_temporada_summary_kpi ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read" ON charlas_temporada_summary_kpi;
CREATE POLICY "Allow public read" ON charlas_temporada_summary_kpi FOR SELECT USING (true);

ALTER TABLE charlas_programa_totales_kpi ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read" ON charlas_programa_totales_kpi;
CREATE POLICY "Allow public read" ON charlas_programa_totales_kpi FOR SELECT USING (true);

ALTER TABLE event_targets_kpi ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read" ON event_targets_kpi;
CREATE POLICY "Allow public read" ON event_targets_kpi FOR SELECT USING (true);

-- ============================================================
-- Analytics / RRSS tables
-- ============================================================

ALTER TABLE social_media_snapshots_kpi ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read" ON social_media_snapshots_kpi;
CREATE POLICY "Allow public read" ON social_media_snapshots_kpi FOR SELECT USING (true);

ALTER TABLE contact_form_submissions_kpi ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read" ON contact_form_submissions_kpi;
CREATE POLICY "Allow public read" ON contact_form_submissions_kpi FOR SELECT USING (true);

ALTER TABLE profession_url_mapping_kpi ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read" ON profession_url_mapping_kpi;
CREATE POLICY "Allow public read" ON profession_url_mapping_kpi FOR SELECT USING (true);

-- ============================================================
-- Finance / billing tables
-- ============================================================

ALTER TABLE pagos_candidato_kpi ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read" ON pagos_candidato_kpi;
CREATE POLICY "Allow public read" ON pagos_candidato_kpi FOR SELECT USING (true);

ALTER TABLE placement_billing_kpi ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read" ON placement_billing_kpi;
CREATE POLICY "Allow public read" ON placement_billing_kpi FOR SELECT USING (true);

ALTER TABLE project_costs_kpi ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read" ON project_costs_kpi;
CREATE POLICY "Allow public read" ON project_costs_kpi FOR SELECT USING (true);

ALTER TABLE curso_desarrollo_kpi ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read" ON curso_desarrollo_kpi;
CREATE POLICY "Allow public read" ON curso_desarrollo_kpi FOR SELECT USING (true);

-- ============================================================
-- Config / preferences
-- ============================================================

ALTER TABLE user_preferences_kpi ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read" ON user_preferences_kpi;
CREATE POLICY "Allow public read" ON user_preferences_kpi FOR SELECT USING (true);

-- dashboard_config_kpi stores sensitive tokens — restrict to service role only
-- (No SELECT policy = anon cannot read it. Correct.)
ALTER TABLE dashboard_config_kpi ENABLE ROW LEVEL SECURITY;

COMMIT;
