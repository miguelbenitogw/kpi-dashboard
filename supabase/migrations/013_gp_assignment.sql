-- Migration 013: gp_assignment field on candidates
-- Source: column "Assignment" from Global Placement tab of Excel Madre
-- Stores the specific placement location/assignment (e.g. "Voss", "Åfjord")

ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS gp_assignment text;

COMMENT ON COLUMN candidates.gp_assignment IS
  'Destino de assignment del candidato — columna "Assignment" del tab Global Placement del Excel Madre';
