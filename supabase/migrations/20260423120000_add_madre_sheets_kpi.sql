CREATE TABLE IF NOT EXISTS madre_sheets_kpi (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_id   text NOT NULL UNIQUE,
  label      text NOT NULL,           -- e.g. "2025", "2026"
  year       int,                     -- optional numeric year
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Seed both known Excel Madres
INSERT INTO madre_sheets_kpi (sheet_id, label, year) VALUES
  ('1XLawLxIbwfBOHwEejR1ksOl0v2gyolHtuqLs0aF1Ujo', '2025', 2025),
  ('1jNmyHejPA4iGoSm-AiIzqL6d3m4E0cJa3gGmKfQDAs0', '2026', 2026);
