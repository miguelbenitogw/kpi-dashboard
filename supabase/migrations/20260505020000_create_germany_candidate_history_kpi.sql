CREATE TABLE IF NOT EXISTS germany_candidate_history_kpi (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zoho_candidate_id      text NOT NULL,       -- Candidate_ID corto (ej: "51517")
  zoho_record_id         text,                -- record ID largo de Zoho
  candidate_name         text,
  job_opening_id         text NOT NULL,       -- ID largo de la vacante (= job_openings_kpi.id)
  job_opening_title      text,
  candidate_status       text,                -- estado actual en esa vacante
  fetched_at             timestamptz DEFAULT now(),
  UNIQUE (zoho_candidate_id, job_opening_id)
);

CREATE INDEX IF NOT EXISTS idx_germany_hist_candidate
ON germany_candidate_history_kpi(zoho_candidate_id);

CREATE INDEX IF NOT EXISTS idx_germany_hist_job
ON germany_candidate_history_kpi(job_opening_id);

-- Tabla de cambios de estado (stage history)
CREATE TABLE IF NOT EXISTS germany_stage_history_kpi (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zoho_candidate_id text NOT NULL,
  job_opening_id    text NOT NULL,
  candidate_name    text,
  job_opening_title text,
  from_status       text,
  to_status         text NOT NULL,
  changed_at        timestamptz DEFAULT now(),
  UNIQUE (zoho_candidate_id, job_opening_id, from_status, to_status, changed_at)
);

CREATE INDEX IF NOT EXISTS idx_germany_stage_candidate
ON germany_stage_history_kpi(zoho_candidate_id);
