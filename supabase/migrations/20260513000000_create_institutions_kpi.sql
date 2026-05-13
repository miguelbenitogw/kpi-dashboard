-- ─────────────────────────────────────────────────────────────────
-- institutions_kpi
-- One row per (profesion × comunidad_autonoma × universidad).
-- Covers all 7 profession BBDD tabs in the Google Sheet BBDD Instituciones.
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE institutions_kpi (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  profesion                 TEXT NOT NULL,           -- e.g. 'ENFERMERÍA', 'FISIOTERAPIA'
  comunidad_autonoma        TEXT,
  universidad               TEXT NOT NULL,

  -- INFORMACIÓN DEL CONTEXTO
  num_visitas               INTEGER,
  años_visitas_ponentes     TEXT,
  alumnos_registrados_zoho  INTEGER,
  tipo_evento_ultima_charla TEXT,                    -- Familia A only (Ed. Infantil, Veterinaria)
  fecha_ultima_charla       DATE,                    -- Familia A only

  -- ACTUALIZACIÓN DEL ESTADO
  ticker_estado             TEXT,
  estado_charla             TEXT,
  comentarios               TEXT,                    -- "DIARIO" in some tabs, "COMENTARIOS" in others
  mes_contactar_de_nuevo    TEXT,
  mensaje_programado        TEXT,

  -- Contacto facultad (from LISTA DE PRINCIPALES CONTACTOS section)
  email_facultad            TEXT,
  telefono_facultad         TEXT,

  -- AGENDA DE EVENTOS
  ticker_agenda             TEXT,
  persona_contacto_agenda   TEXT,
  fecha_charla_visita       DATE,
  hora_charla               TEXT,
  lugar_concreto            TEXT,
  tipo_evento               TEXT,
  compañero_asiste          TEXT,
  duracion_charla           TEXT,

  -- ACTUALIZACIÓN DEL EVENTO
  num_asistentes_charla     INTEGER,
  num_interesados_firmas    INTEGER,
  global_worker_asiste      TEXT,
  recursos_entregados       TEXT,

  -- INFORMACIÓN DEL CENTRO
  ciudad                    TEXT,
  ubicacion                 TEXT,
  tipo_centro               TEXT,
  web                       TEXT,
  correos_profesores_web    TEXT,
  plazas_anio               INTEGER,

  -- Sync metadata
  synced_at                 TIMESTAMPTZ DEFAULT NOW(),
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  updated_at                TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (profesion, comunidad_autonoma, universidad)
);

-- ─────────────────────────────────────────────────────────────────
-- institution_contacts_kpi
-- Up to 5 contacts per institution (normalised from merged columns).
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE institution_contacts_kpi (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id   UUID NOT NULL REFERENCES institutions_kpi(id) ON DELETE CASCADE,
  contact_number   INTEGER NOT NULL CHECK (contact_number BETWEEN 1 AND 5),
  nombre_cargo     TEXT,
  contacto         TEXT,
  feedback         TEXT,    -- Only contact #1 typically has a value

  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (institution_id, contact_number)
);

-- ─────────────────────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────────────────────
CREATE INDEX idx_institutions_kpi_profesion      ON institutions_kpi (profesion);
CREATE INDEX idx_institutions_kpi_comunidad      ON institutions_kpi (comunidad_autonoma);
CREATE INDEX idx_institutions_kpi_estado_charla  ON institutions_kpi (estado_charla);
CREATE INDEX idx_institution_contacts_inst       ON institution_contacts_kpi (institution_id);

-- ─────────────────────────────────────────────────────────────────
-- RLS — same pattern as existing _kpi tables
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE institutions_kpi          ENABLE ROW LEVEL SECURITY;
ALTER TABLE institution_contacts_kpi  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read institutions_kpi"
  ON institutions_kpi FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "authenticated read institution_contacts_kpi"
  ON institution_contacts_kpi FOR SELECT
  TO authenticated USING (true);

-- ─────────────────────────────────────────────────────────────────
-- updated_at triggers
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_institutions_kpi_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_institutions_kpi_updated_at
  BEFORE UPDATE ON institutions_kpi
  FOR EACH ROW EXECUTE FUNCTION update_institutions_kpi_updated_at();

CREATE OR REPLACE FUNCTION update_institution_contacts_kpi_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_institution_contacts_kpi_updated_at
  BEFORE UPDATE ON institution_contacts_kpi
  FOR EACH ROW EXECUTE FUNCTION update_institution_contacts_kpi_updated_at();
