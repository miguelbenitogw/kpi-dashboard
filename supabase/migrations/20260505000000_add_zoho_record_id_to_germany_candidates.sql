ALTER TABLE germany_candidates_kpi
ADD COLUMN IF NOT EXISTS zoho_record_id text;

CREATE INDEX IF NOT EXISTS idx_germany_candidates_zoho_record_id
ON germany_candidates_kpi(zoho_record_id);
