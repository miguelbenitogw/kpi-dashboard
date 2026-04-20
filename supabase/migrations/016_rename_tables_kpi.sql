-- Migration 016: Rename all KPI tables to _kpi suffix
-- The Supabase project is SHARED with another system that owns tables
-- like 'promotions' without a namespace.  All tables that belong to this
-- KPI dashboard get a _kpi suffix so names never collide.
--
-- Strategy:
--   • ALTER TABLE IF EXISTS x RENAME TO x_kpi   → safe even if table absent
--   • 'promotions' is NOT renamed (belongs to another system)
--   • promotions_kpi is created fresh with the correct KPI schema
--   • FK candidates.promotion_id → promotions.id is dropped before rename
--     and re-added as candidates_kpi.promotion_id → promotions_kpi.id after
--   • Missing columns from migrations 003 + 015 applied to job_openings_kpi

BEGIN;

-- ============================================================
-- PART 1 — Drop cross-system FK before renaming candidates
-- ============================================================
-- The FK constraint auto-name is candidates_promotion_id_fkey.
-- Use a DO block so it silently skips if the column / constraint never existed.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'candidates'
      AND constraint_name = 'candidates_promotion_id_fkey'
  ) THEN
    ALTER TABLE candidates DROP CONSTRAINT candidates_promotion_id_fkey;
  END IF;
END $$;

-- ============================================================
-- PART 2 — Rename core KPI tables
-- ============================================================

-- Core data tables
ALTER TABLE IF EXISTS candidates            RENAME TO candidates_kpi;
ALTER TABLE IF EXISTS job_openings          RENAME TO job_openings_kpi;

-- Promo tables
ALTER TABLE IF EXISTS promo_sheets          RENAME TO promo_sheets_kpi;
ALTER TABLE IF EXISTS promo_targets         RENAME TO promo_targets_kpi;
ALTER TABLE IF EXISTS promo_students        RENAME TO promo_students_kpi;
ALTER TABLE IF EXISTS promo_job_link        RENAME TO promo_job_link_kpi;

-- History / tracking
ALTER TABLE IF EXISTS candidate_job_history RENAME TO candidate_job_history_kpi;

-- Legacy tables (may or may not exist — IF EXISTS handles absence safely)
ALTER TABLE IF EXISTS stage_history         RENAME TO stage_history_kpi;
ALTER TABLE IF EXISTS sla_alerts            RENAME TO sla_alerts_kpi;
ALTER TABLE IF EXISTS daily_snapshot        RENAME TO daily_snapshot_kpi;
ALTER TABLE IF EXISTS sync_log              RENAME TO sync_log_kpi;

-- Config / preferences
ALTER TABLE IF EXISTS user_preferences      RENAME TO user_preferences_kpi;
ALTER TABLE IF EXISTS dashboard_config      RENAME TO dashboard_config_kpi;

-- Charlas / event tables (from migration 008+009)
ALTER TABLE IF EXISTS charlas_registros           RENAME TO charlas_registros_kpi;
ALTER TABLE IF EXISTS charlas_temporada           RENAME TO charlas_temporada_kpi;
ALTER TABLE IF EXISTS charlas_temporada_summary   RENAME TO charlas_temporada_summary_kpi;
ALTER TABLE IF EXISTS charlas_programa_totales    RENAME TO charlas_programa_totales_kpi;
ALTER TABLE IF EXISTS event_targets               RENAME TO event_targets_kpi;

-- Analytics stubs (from migration 008)
ALTER TABLE IF EXISTS social_media_snapshots  RENAME TO social_media_snapshots_kpi;
ALTER TABLE IF EXISTS contact_form_submissions RENAME TO contact_form_submissions_kpi;
ALTER TABLE IF EXISTS profession_url_mapping   RENAME TO profession_url_mapping_kpi;
ALTER TABLE IF EXISTS curso_desarrollo         RENAME TO curso_desarrollo_kpi;
ALTER TABLE IF EXISTS pagos_candidato          RENAME TO pagos_candidato_kpi;
ALTER TABLE IF EXISTS placement_billing        RENAME TO placement_billing_kpi;
ALTER TABLE IF EXISTS project_costs            RENAME TO project_costs_kpi;

-- NOTE: 'promotions' is intentionally NOT renamed — it belongs to another
-- application sharing this Supabase project.

-- ============================================================
-- PART 3 — Apply missing columns to job_openings_kpi
-- (Migrations 003 and 015 may not have been applied before this rename)
-- ============================================================

-- 3a. category (from migration 003)
ALTER TABLE job_openings_kpi
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'atraccion';

-- Recreate constraint to ensure correct values after possible partial state
ALTER TABLE job_openings_kpi
  DROP CONSTRAINT IF EXISTS job_openings_category_check;
ALTER TABLE job_openings_kpi
  ADD CONSTRAINT job_openings_category_check
  CHECK (category IN ('atraccion', 'rendimiento', 'interna'));

-- Classify existing rows from title (promo → rendimiento, default atraccion)
UPDATE job_openings_kpi
  SET category = 'rendimiento'
  WHERE title ILIKE '%promo%'
    AND category = 'atraccion';

-- 3b. tipo_profesional (from migration 015)
ALTER TABLE job_openings_kpi
  ADD COLUMN IF NOT EXISTS tipo_profesional text NOT NULL DEFAULT 'otro';
ALTER TABLE job_openings_kpi
  DROP CONSTRAINT IF EXISTS job_openings_tipo_profesional_check;
ALTER TABLE job_openings_kpi
  ADD CONSTRAINT job_openings_tipo_profesional_check
  CHECK (tipo_profesional IN (
    'enfermero', 'fisioterapeuta',
    'maestro_infantil', 'maestro_primaria',
    'medico', 'otro'
  ));

-- 3c. Tags + flags (from migration 015)
ALTER TABLE job_openings_kpi
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';
ALTER TABLE job_openings_kpi
  ADD COLUMN IF NOT EXISTS es_proceso_atraccion_actual boolean NOT NULL DEFAULT false;
ALTER TABLE job_openings_kpi
  ADD COLUMN IF NOT EXISTS job_description text;

-- 3d. Indexes
CREATE INDEX IF NOT EXISTS job_openings_kpi_category_idx
  ON job_openings_kpi (category);
CREATE INDEX IF NOT EXISTS job_openings_kpi_tipo_idx
  ON job_openings_kpi (tipo_profesional);
CREATE INDEX IF NOT EXISTS job_openings_kpi_proceso_atraccion_idx
  ON job_openings_kpi (es_proceso_atraccion_actual)
  WHERE es_proceso_atraccion_actual = true;
CREATE INDEX IF NOT EXISTS job_openings_kpi_category_status_idx
  ON job_openings_kpi (category, status);

-- ============================================================
-- PART 4 — Create promotions_kpi (proper KPI schema)
-- ============================================================

CREATE TABLE IF NOT EXISTS promotions_kpi (
  id             uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre         text    NOT NULL UNIQUE,     -- "Promoción 113"
  numero         int,                         -- 113
  modalidad      text,                        -- Online / Semi / Presencial
  pais           text,                        -- España / Italia / Francia
  coordinador    text,
  cliente        text,
  fecha_inicio   date,
  fecha_fin      date,
  -- Targets (from Excel madre Resumen)
  objetivo_atraccion  int,
  objetivo_programa   int,
  expectativa_finalizan int,
  -- Calculated / synced counts
  total_aceptados   int DEFAULT 0,
  total_programa    int DEFAULT 0,
  total_hired       int DEFAULT 0,
  total_dropouts    int DEFAULT 0,
  total_candidates  int DEFAULT 0,
  -- Linked resources
  zoho_job_opening_id  text,
  sheet_url            text,
  sheet_madre_row      int,
  -- Status
  is_active  boolean DEFAULT true,
  phase      text    DEFAULT 'formacion',
  -- Metadata
  raw_data   jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS promotions_kpi_nombre_idx
  ON promotions_kpi (nombre);
CREATE INDEX IF NOT EXISTS promotions_kpi_numero_idx
  ON promotions_kpi (numero);
CREATE INDEX IF NOT EXISTS promotions_kpi_active_idx
  ON promotions_kpi (is_active) WHERE is_active = true;

ALTER TABLE promotions_kpi ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read" ON promotions_kpi FOR SELECT USING (true);

-- ============================================================
-- PART 5 — Re-attach candidates_kpi.promotion_id → promotions_kpi
-- ============================================================

DO $$
BEGIN
  -- Only add the FK if the column exists on candidates_kpi and is not
  -- already constrained (idempotent guard)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'candidates_kpi'
      AND column_name = 'promotion_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'candidates_kpi'
      AND constraint_name = 'candidates_kpi_promotion_id_fkey'
  ) THEN
    ALTER TABLE candidates_kpi
      ADD CONSTRAINT candidates_kpi_promotion_id_fkey
      FOREIGN KEY (promotion_id) REFERENCES promotions_kpi(id);
  END IF;
END $$;

-- ============================================================
-- PART 6 — AI agent tables
-- ============================================================

-- 6a. User OpenAI key storage (per user, encrypted at application layer)
CREATE TABLE IF NOT EXISTS user_openai_keys_kpi (
  user_email        text PRIMARY KEY,
  encrypted_key     text NOT NULL,                       -- AES-256-GCM, base64
  model_preference  text NOT NULL DEFAULT 'gpt-4o-mini',
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

COMMENT ON TABLE user_openai_keys_kpi IS
  'Stores per-user OpenAI API keys encrypted at the application layer. '
  'The dashboard never sends OpenAI costs to Anthropic — each user pays their own key.';

-- 6b. Chat sessions (one per conversation thread)
CREATE TABLE IF NOT EXISTS chat_sessions_kpi (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email  text NOT NULL,
  title       text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_sessions_kpi_user_idx
  ON chat_sessions_kpi (user_email, created_at DESC);

-- 6c. Chat messages
CREATE TABLE IF NOT EXISTS chat_messages_kpi (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   uuid NOT NULL REFERENCES chat_sessions_kpi(id) ON DELETE CASCADE,
  role         text NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
  content      text,
  tool_calls   jsonb,   -- OpenAI tool_calls array
  tool_results jsonb,   -- results returned from tool execution
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_messages_kpi_session_idx
  ON chat_messages_kpi (session_id, created_at);

-- 6d. AI alert rules
CREATE TABLE IF NOT EXISTS ai_alerts_kpi (
  id                  uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email          text    NOT NULL,
  name                text    NOT NULL,
  description         text,
  -- condition_type: 'threshold' | 'change' | 'absence'
  condition_type      text    NOT NULL,
  condition_config    jsonb   NOT NULL DEFAULT '{}',
  notification_email  text    NOT NULL,
  is_active           boolean NOT NULL DEFAULT true,
  last_evaluated_at   timestamptz,
  last_triggered_at   timestamptz,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_alerts_kpi_user_idx
  ON ai_alerts_kpi (user_email);
CREATE INDEX IF NOT EXISTS ai_alerts_kpi_active_idx
  ON ai_alerts_kpi (is_active) WHERE is_active = true;

-- 6e. Alert event log (each time an alert fires)
CREATE TABLE IF NOT EXISTS ai_alert_events_kpi (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id            uuid NOT NULL REFERENCES ai_alerts_kpi(id) ON DELETE CASCADE,
  triggered_at        timestamptz NOT NULL DEFAULT now(),
  condition_snapshot  jsonb,   -- snapshot of the data that triggered the alert
  email_sent          boolean DEFAULT false,
  email_error         text
);

CREATE INDEX IF NOT EXISTS ai_alert_events_kpi_alert_idx
  ON ai_alert_events_kpi (alert_id, triggered_at DESC);

COMMIT;
