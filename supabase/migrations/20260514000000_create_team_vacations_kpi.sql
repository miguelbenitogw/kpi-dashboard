CREATE TABLE IF NOT EXISTS team_members_kpi (
  id serial PRIMARY KEY,
  name text NOT NULL UNIQUE,
  sheet_tab_name text NOT NULL,
  tarde_larga_dia text,
  tarde_larga_cambios text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS team_vacations_kpi (
  id serial PRIMARY KEY,
  member_id integer NOT NULL REFERENCES team_members_kpi(id) ON DELETE CASCADE,
  year integer NOT NULL,
  day_number integer NOT NULL,
  vacation_date date,
  status text NOT NULL DEFAULT 'Pendiente',
  created_at timestamptz DEFAULT now(),
  UNIQUE(member_id, year, day_number)
);

ALTER TABLE team_members_kpi ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_vacations_kpi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read team_members_kpi"
  ON team_members_kpi FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read team_vacations_kpi"
  ON team_vacations_kpi FOR SELECT TO authenticated USING (true);
