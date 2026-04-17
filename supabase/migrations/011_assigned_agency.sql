-- Migration 011: assigned_agency field on candidates
-- Source: column "Assigned Agency" from Global Placement tab of Excel Madre

ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS assigned_agency text;

COMMENT ON COLUMN candidates.assigned_agency IS
  'Agencia asignada para el placement — columna "Assigned Agency" del tab Global Placement del Excel Madre';
