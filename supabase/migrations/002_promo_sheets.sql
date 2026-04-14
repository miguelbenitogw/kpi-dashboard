-- Migration 002: Promo Google Sheets integration
-- Links a Google Sheet (e.g. "Promo 113") to a Zoho job opening and stores
-- per-student data from each tab of that sheet.

-- ---------------------------------------------------------------------------
-- promo_sheets: registry of known promotion sheets
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS promo_sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Foreign key into our job_openings table (Zoho job opening ID as the PK there)
  job_opening_id text REFERENCES job_openings(id),
  sheet_url text NOT NULL,
  sheet_id text,                        -- extracted Google Sheet document ID
  sheet_name text,                      -- human label, e.g. "Promo 113"
  last_synced_at timestamptz,
  sync_status text DEFAULT 'pending',   -- pending | syncing | done | error
  sync_error text,                      -- last error message if any
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (sheet_url)
);

-- ---------------------------------------------------------------------------
-- promo_students: one row per student row found in the sheet (any tab)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS promo_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_sheet_id uuid NOT NULL REFERENCES promo_sheets(id) ON DELETE CASCADE,
  job_opening_id text,                  -- denormalised for fast filtering

  -- Identity fields (filled from sheet columns as found)
  full_name text,
  email text,
  phone text,
  nationality text,
  country_of_residence text,
  native_language text,
  english_level text,
  german_level text,
  work_permit text,

  -- Sheet tracking
  sheet_status text,                    -- status as recorded in the sheet
  sheet_stage text,                     -- stage column if present
  start_date date,                      -- promo/course start date
  end_date date,                        -- promo/course end date
  enrollment_date date,                 -- when they enrolled

  -- Dropouts / bajas tab specific fields
  dropout_reason text,                  -- reason for dropping out
  dropout_date date,                    -- date they dropped out
  dropout_notes text,

  -- Notes / comments
  notes text,

  -- Zoho cross-reference (filled during matching step)
  zoho_candidate_id text,               -- Zoho candidate ID if matched
  zoho_status text,                     -- current status in Zoho at time of last sync
  zoho_matched_at timestamptz,          -- when the match was established
  match_confidence text,                -- exact_email | name_similarity | unmatched

  -- Raw storage: full row as JSON for schema flexibility
  raw_data jsonb,

  -- Source tracking
  tab_name text,                        -- which sheet tab this row came from
  row_number int,                       -- original 1-based row number in the tab

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Prevent duplicate rows from re-syncs
  UNIQUE (promo_sheet_id, tab_name, row_number)
);

-- ---------------------------------------------------------------------------
-- Indexes for common query patterns
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS promo_students_job_opening_idx
  ON promo_students (job_opening_id);

CREATE INDEX IF NOT EXISTS promo_students_zoho_candidate_idx
  ON promo_students (zoho_candidate_id)
  WHERE zoho_candidate_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS promo_students_email_idx
  ON promo_students (email)
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS promo_students_promo_sheet_idx
  ON promo_students (promo_sheet_id);

CREATE INDEX IF NOT EXISTS promo_sheets_job_opening_idx
  ON promo_sheets (job_opening_id);

-- ---------------------------------------------------------------------------
-- updated_at trigger (reuse pattern from rest of schema)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER promo_sheets_updated_at
  BEFORE UPDATE ON promo_sheets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER promo_students_updated_at
  BEFORE UPDATE ON promo_students
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
