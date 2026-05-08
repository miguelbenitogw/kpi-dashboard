-- Migration: add telefono and telefono_aleman to germany_payments_kpi
--
-- Sheet "Pagos - Proyectos Infantil" has two phone columns:
--   col 1: "Teléfono"        — domestic phone number
--   col 2: "teléfono Aleman" — German phone number (acquired after arrival)
--
-- Both were missing from the schema and the importer.
-- This migration adds them so the next sync captures them.

BEGIN;

ALTER TABLE germany_payments_kpi
  ADD COLUMN IF NOT EXISTS telefono        text,
  ADD COLUMN IF NOT EXISTS telefono_aleman text;

COMMENT ON COLUMN germany_payments_kpi.telefono        IS 'Teléfono del candidato (col 1 de Pagos - Proyectos Infantil)';
COMMENT ON COLUMN germany_payments_kpi.telefono_aleman IS 'Teléfono alemán del candidato — adquirido tras llegar a Alemania (col 2 de Pagos - Proyectos Infantil)';

COMMIT;
