CREATE TABLE IF NOT EXISTS stage_history_kpi (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id   text        NOT NULL,
  job_opening_id text        NOT NULL,
  from_status    text,
  to_status      text        NOT NULL,
  changed_at     timestamptz NOT NULL,
  UNIQUE (candidate_id, job_opening_id, from_status, to_status, changed_at)
);

CREATE INDEX IF NOT EXISTS idx_sth_candidate  ON stage_history_kpi (candidate_id);
CREATE INDEX IF NOT EXISTS idx_sth_changed_at ON stage_history_kpi (changed_at DESC);

ALTER TABLE stage_history_kpi ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read stage_history_kpi"
  ON stage_history_kpi FOR SELECT TO authenticated USING (true);
