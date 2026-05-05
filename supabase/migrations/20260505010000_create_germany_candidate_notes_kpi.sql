CREATE TABLE IF NOT EXISTS germany_candidate_notes_kpi (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zoho_record_id  text NOT NULL,
  zoho_note_id    text NOT NULL,
  candidate_name  text,
  zoho_candidate_id text,
  note_title      text,
  note_content    text,
  note_owner      text,
  created_by      text,
  created_at      timestamptz,
  modified_at     timestamptz,
  synced_at       timestamptz DEFAULT now(),
  UNIQUE (zoho_note_id)
);

CREATE INDEX IF NOT EXISTS idx_germany_notes_zoho_record_id
ON germany_candidate_notes_kpi(zoho_record_id);

CREATE INDEX IF NOT EXISTS idx_germany_notes_zoho_candidate_id
ON germany_candidate_notes_kpi(zoho_candidate_id);
