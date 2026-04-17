-- Migration 010: Campos faltantes detectados en revisión 2026-04-17
-- Fuente: docs/EXCEL_REALITY_CHECK.md
--
-- Agrega a `candidates`:
--   1. Tres campos de dropout (pestaña "Dropouts" del Excel por promo):
--      modality, start_date, days_of_training
--   2. Campos de Base Datos del Excel Madre no persistidos:
--      quincena, mes_llegada
--   3. Campos extra de Global Placement (tab del Excel Madre, NO de GP-Candidate.xlsx):
--      kontaktperson, training_status, availability, open_to,
--      priority, shots, has_gp_profile

BEGIN;

-- === Dropout fields (cols D, E, G de la pestaña "Dropouts (abandonos)") ===
-- En candidates: se sincronizan desde promo_students via syncDropoutsToCandidates
ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS dropout_modality         text,
  ADD COLUMN IF NOT EXISTS dropout_start_date       date,
  ADD COLUMN IF NOT EXISTS dropout_days_of_training integer;

-- En promo_students: se escriben directamente al parsear el tab Dropouts
ALTER TABLE promo_students
  ADD COLUMN IF NOT EXISTS dropout_modality         text,
  ADD COLUMN IF NOT EXISTS dropout_days_of_training integer;

COMMENT ON COLUMN candidates.dropout_modality IS
  'Modalidad de formación al abandonar — columna D (Modality) de la pestaña Dropouts del Excel por promo';
COMMENT ON COLUMN candidates.dropout_start_date IS
  'Fecha de inicio de formación — columna E (Start date) de la pestaña Dropouts';
COMMENT ON COLUMN candidates.dropout_days_of_training IS
  'Días de formación al momento del abandono — columna G (Days of training) de la pestaña Dropouts';

-- === Base Datos fields (tab "Base Datos" del Excel Madre) ===
ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS quincena    text,
  ADD COLUMN IF NOT EXISTS mes_llegada text;

COMMENT ON COLUMN candidates.quincena IS
  'Quincena de llegada (1ª / 2ª) — columna Quincena del tab Base Datos del Excel Madre';
COMMENT ON COLUMN candidates.mes_llegada IS
  'Mes y año de llegada a Noruega — columna "Mes y año de llegada" del tab Base Datos';

-- === Global Placement extended fields (tab "Global Placement" del Excel Madre) ===
-- Nota: NO proceden de GP-Candidate.xlsx (ese archivo no se usa).
-- Son columnas extra del tab Global Placement del Excel Madre que el importer
-- actual no persistía (solo importaba 7 de 27 columnas).
ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS gp_kontaktperson   text,
  ADD COLUMN IF NOT EXISTS gp_training_status text,
  ADD COLUMN IF NOT EXISTS gp_availability    text,
  ADD COLUMN IF NOT EXISTS gp_open_to         text,
  ADD COLUMN IF NOT EXISTS gp_priority        text,
  ADD COLUMN IF NOT EXISTS gp_shots           text,
  ADD COLUMN IF NOT EXISTS gp_has_profile     boolean;

COMMENT ON COLUMN candidates.gp_kontaktperson IS
  'Persona de contacto GP (columna Kontaktperson del tab Global Placement del Excel Madre)';
COMMENT ON COLUMN candidates.gp_training_status IS
  'Status (Training) — distinto de current_status y placement_status';
COMMENT ON COLUMN candidates.gp_availability IS
  'Availability — disponibilidad para placement';
COMMENT ON COLUMN candidates.gp_open_to IS
  'Open to — tipo de oferta aceptable (Vikar, Kommuner, etc.)';
COMMENT ON COLUMN candidates.gp_priority IS
  'Prioridad en el pipeline de placement';
COMMENT ON COLUMN candidates.gp_shots IS
  'Estado del programa SHOTS (vacunación) para Noruega';
COMMENT ON COLUMN candidates.gp_has_profile IS
  'Si tiene perfil creado en Global Placement';

-- === Pagos / Costes por proyecto (pestaña "Pagos - Proyectos" del Excel Madre) ===
-- Fuente directa para Costes/Margen (columna BY del Cuadro de Mando).
CREATE TABLE IF NOT EXISTS pagos_candidato (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id           text REFERENCES candidates(id) ON DELETE SET NULL,
  promocion_nombre       text,
  full_name              text NOT NULL,
  email                  text,
  telefono               text,
  perfil                 text,
  coordinador            text,
  modalidad              text,
  estado                 text,
  fecha_viaje_noruega    date,
  fecha_inicio_formacion date,
  fecha_abandono         date,
  fecha_respuesta_mail   date,
  fase_abandono          text,
  condiciones_fase       text,
  precio_hora            numeric(10, 2),
  horas_cursadas         numeric(10, 2),
  precio_total           numeric(10, 2),
  promocion_anterior     text,
  anexo_firmado          boolean,
  precio_formacion       numeric(10, 2),
  created_at             timestamptz DEFAULT now(),
  updated_at             timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pagos_candidato_promocion_idx
  ON pagos_candidato (promocion_nombre);
CREATE INDEX IF NOT EXISTS pagos_candidato_candidate_idx
  ON pagos_candidato (candidate_id);

COMMENT ON TABLE pagos_candidato IS
  'Fuente de Costes/Margen (Cuadro de Mando col BY). Origen: tab "Pagos - Proyectos" del Excel Madre.';

COMMIT;
