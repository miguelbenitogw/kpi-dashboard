-- Missing GP / placement columns on candidates_kpi
-- Source: Global Placement + GP-Applications + Base Datos tabs in Excel Madre Noruega

ALTER TABLE candidates_kpi
  ADD COLUMN IF NOT EXISTS gp_finish_date              date,
  ADD COLUMN IF NOT EXISTS gp_tipo_perfil              text,
  ADD COLUMN IF NOT EXISTS gp_preferences              text,
  ADD COLUMN IF NOT EXISTS gp_hpr_nummer               text,
  ADD COLUMN IF NOT EXISTS gp_webcruiter               boolean,
  ADD COLUMN IF NOT EXISTS gp_application_sent         boolean,
  ADD COLUMN IF NOT EXISTS gp_profile_talent_portal    boolean,
  ADD COLUMN IF NOT EXISTS gp_seminar                  text,
  ADD COLUMN IF NOT EXISTS gp_total_applications       integer,
  ADD COLUMN IF NOT EXISTS gp_interviews_ratio         text,
  ADD COLUMN IF NOT EXISTS gp_applications_this_period integer,
  ADD COLUMN IF NOT EXISTS gp_quincena                 text,
  ADD COLUMN IF NOT EXISTS gp_mes_anio_llegada         text;

-- Individual job applications tracking
-- Source: GP-Applications tab in Excel Madre 2025 (31 blocks × 5 fields per candidate)
CREATE TABLE IF NOT EXISTS norway_gp_applications_kpi (
  id                 bigserial    PRIMARY KEY,
  candidate_id       text         NOT NULL,
  nombre             text,
  sheet_year         integer,
  sheet_id           text,
  block_number       integer,
  job_title          text,
  job_link           text,
  application_date   text,
  application_status text,
  comment            text,
  synced_at          timestamptz  DEFAULT now(),
  UNIQUE (candidate_id, sheet_year, block_number)
);

CREATE INDEX IF NOT EXISTS idx_norway_gp_applications_candidate
  ON norway_gp_applications_kpi (candidate_id);
CREATE INDEX IF NOT EXISTS idx_norway_gp_applications_year
  ON norway_gp_applications_kpi (sheet_year);
