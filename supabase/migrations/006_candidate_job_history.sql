CREATE TABLE IF NOT EXISTS candidate_job_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id text NOT NULL,
  candidate_name text,
  zoho_record_id text,
  job_opening_id text,
  job_opening_title text,
  candidate_status_in_jo text,
  association_type text, -- 'atraccion', 'formacion', 'interna', 'unknown'
  fetched_at timestamptz DEFAULT now(),
  UNIQUE (candidate_id, job_opening_id)
);
CREATE INDEX idx_cjh_candidate ON candidate_job_history(candidate_id);
CREATE INDEX idx_cjh_job_opening ON candidate_job_history(job_opening_id);
ALTER TABLE candidate_job_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read" ON candidate_job_history FOR SELECT USING (true);
