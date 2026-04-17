-- Migration 009: Charlas y Webinars (Atracción / Instituciones)
-- Mapping a columnas I3, J3, K3, S3 del Cuadro de Mando GW.
-- Fuente: "Registrados Charlas y Webinars - Total.csv" (agregado por temporada + programa).

CREATE TABLE IF NOT EXISTS charlas_temporada (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  temporada                   text NOT NULL,                      -- "2021-2022"
  programa                    text NOT NULL,                      -- "Enfermería" | "Educación Infantil" | ...
  total_inscritos_charlas     integer,                            -- presenciales (I3)
  total_inscritos_webinars    integer,                            -- online (S3)
  total_inscritos             integer,                            -- suma (K3 / U3)
  charlas_realizadas          integer,                            -- nº eventos (I3/J3 counter)
  formacion_from_uni          integer,                            -- personas en formación provenientes de Uni
  formacion_from_webinar      integer,                            -- personas en formación provenientes de webinar
  total_formacion             integer,                            -- total personas que llegaron a formación
  promociones_revisadas       text,                               -- lista libre "51, 52, 53, ..."
  observaciones               text,
  created_at                  timestamptz DEFAULT now(),
  updated_at                  timestamptz DEFAULT now(),
  UNIQUE (temporada, programa)
);

CREATE INDEX IF NOT EXISTS charlas_temporada_temporada_idx
  ON charlas_temporada (temporada);

CREATE INDEX IF NOT EXISTS charlas_temporada_programa_idx
  ON charlas_temporada (programa);

COMMENT ON TABLE charlas_temporada IS
  'Agregado anual de charlas y webinars por programa. Cuadro de Mando GW cols I3, J3, K3, S3.';

-- Totales por programa (fila ENFERMERÍA / EDUCACIÓN INFANTIL del CSV)
CREATE TABLE IF NOT EXISTS charlas_programa_totales (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  programa                    text NOT NULL UNIQUE,               -- "Enfermería" | "Educación Infantil"
  total_personas_formaciones  integer,                            -- total acumulado en formaciones
  total_registros             integer,                            -- total registros histórico
  created_at                  timestamptz DEFAULT now(),
  updated_at                  timestamptz DEFAULT now()
);

COMMENT ON TABLE charlas_programa_totales IS
  'Totales acumulados por programa (fila resumen del CSV Registrados Charlas y Webinars).';
