CREATE TABLE IF NOT EXISTS placement_team_members (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS placement_schedules (
  id           SERIAL PRIMARY KEY,
  member_id    INTEGER NOT NULL REFERENCES placement_team_members(id) ON DELETE CASCADE,
  schedule_date DATE NOT NULL,
  year          INTEGER NOT NULL,
  raw_cell      TEXT,
  time_start    TEXT,
  time_end      TEXT,
  time_start_2  TEXT,
  time_end_2    TEXT,
  status        TEXT NOT NULL DEFAULT 'working',  -- working, holiday, vacation, leave, off
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (member_id, schedule_date)
);

CREATE INDEX IF NOT EXISTS idx_placement_schedules_year_date
  ON placement_schedules (year, schedule_date);

CREATE INDEX IF NOT EXISTS idx_placement_schedules_member_year
  ON placement_schedules (member_id, year);

ALTER TABLE placement_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE placement_schedules    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read placement_team_members"
  ON placement_team_members FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read placement_schedules"
  ON placement_schedules FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role has full access to placement_team_members"
  ON placement_team_members FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to placement_schedules"
  ON placement_schedules FOR ALL TO service_role USING (true) WITH CHECK (true);
