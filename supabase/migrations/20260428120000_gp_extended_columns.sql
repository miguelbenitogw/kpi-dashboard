-- Extended Global Placement columns for candidates_kpi
ALTER TABLE candidates_kpi
  ADD COLUMN IF NOT EXISTS gp_arrival_date          date,
  ADD COLUMN IF NOT EXISTS gp_comments              text,
  ADD COLUMN IF NOT EXISTS gp_cv_norsk              boolean,
  ADD COLUMN IF NOT EXISTS gp_blind_cv_norsk        boolean,
  ADD COLUMN IF NOT EXISTS gp_pk                    text,
  ADD COLUMN IF NOT EXISTS gp_criminal_record       boolean,
  ADD COLUMN IF NOT EXISTS gp_sarm                  boolean,
  ADD COLUMN IF NOT EXISTS gp_mantux                boolean,
  ADD COLUMN IF NOT EXISTS gp_last_update_placement text,
  ADD COLUMN IF NOT EXISTS placement_status         text;

COMMENT ON COLUMN candidates_kpi.gp_arrival_date IS 'Arrival date to Norway (from Global Placement tab)';
COMMENT ON COLUMN candidates_kpi.placement_status IS 'Placement status (from Status (Placement) column in Global Placement tab)';
COMMENT ON COLUMN candidates_kpi.gp_comments IS 'Coordinator comments from Global Placement tab';
