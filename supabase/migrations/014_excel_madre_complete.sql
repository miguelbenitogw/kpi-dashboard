-- Migration 014: Complete Excel Madre coverage
-- Adds remaining GP columns, billing columns for pagos_candidato,
-- state counts to promotions, and the curso_desarrollo table.
BEGIN;

-- 1. candidates — remaining Global Placement columns (9 missing from migration 010)
ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS gp_comments              text,
  ADD COLUMN IF NOT EXISTS gp_cv_norsk              boolean,
  ADD COLUMN IF NOT EXISTS gp_blind_cv_norsk        boolean,
  ADD COLUMN IF NOT EXISTS gp_pk                    text,
  ADD COLUMN IF NOT EXISTS gp_criminal_record       boolean,
  ADD COLUMN IF NOT EXISTS gp_sarm                  boolean,
  ADD COLUMN IF NOT EXISTS gp_mantux                boolean,
  ADD COLUMN IF NOT EXISTS gp_last_update_placement text,
  ADD COLUMN IF NOT EXISTS gp_arrival_date          date;

COMMENT ON COLUMN candidates.gp_comments              IS 'Comments from coordinators in Global Placement tab';
COMMENT ON COLUMN candidates.gp_cv_norsk              IS 'Whether candidate has a Norwegian-language CV';
COMMENT ON COLUMN candidates.gp_blind_cv_norsk        IS 'Whether candidate has a blind Norwegian CV';
COMMENT ON COLUMN candidates.gp_pk                    IS 'PK (Presenting Card) identifier in Global Placement';
COMMENT ON COLUMN candidates.gp_criminal_record       IS 'Criminal record check completed for Norway placement';
COMMENT ON COLUMN candidates.gp_sarm                  IS 'SARM screening flag for Norway placement';
COMMENT ON COLUMN candidates.gp_mantux                IS 'Mantux flag for Norway placement';
COMMENT ON COLUMN candidates.gp_last_update_placement IS 'Last update date string from Global Placement tab';
COMMENT ON COLUMN candidates.gp_arrival_date          IS 'Arrival date in Norway — columna "Arrival" del tab Global Placement';

-- 2. pagos_candidato — remaining billing columns not covered in migration 010
ALTER TABLE pagos_candidato
  ADD COLUMN IF NOT EXISTS autorizacion_tramitada      boolean,
  ADD COLUMN IF NOT EXISTS precio_autorizacion         numeric(10,2),
  ADD COLUMN IF NOT EXISTS importe_formacion_actual    numeric(10,2),
  ADD COLUMN IF NOT EXISTS importe_formaciones_previas numeric(10,2),
  ADD COLUMN IF NOT EXISTS importe_piso_gw             numeric(10,2),
  ADD COLUMN IF NOT EXISTS importe_devolucion_ayuda    numeric(10,2),
  ADD COLUMN IF NOT EXISTS importe_autorizacion        numeric(10,2),
  ADD COLUMN IF NOT EXISTS importe_total               numeric(10,2),
  ADD COLUMN IF NOT EXISTS fecha_cobro                 date,
  ADD COLUMN IF NOT EXISTS importe_pagado_2024         numeric(10,2),
  ADD COLUMN IF NOT EXISTS importe_pagado_2025         numeric(10,2),
  ADD COLUMN IF NOT EXISTS importe_pagado_2026         numeric(10,2),
  ADD COLUMN IF NOT EXISTS importe_pendiente           numeric(10,2),
  ADD COLUMN IF NOT EXISTS condiciones_pago            text,
  ADD COLUMN IF NOT EXISTS fecha_notificacion          date,
  ADD COLUMN IF NOT EXISTS comentarios_coordinadores   text,
  ADD COLUMN IF NOT EXISTS comentarios_contabilidad    text,
  ADD COLUMN IF NOT EXISTS promociones_anteriores      jsonb;

COMMENT ON COLUMN pagos_candidato.autorizacion_tramitada      IS 'Columna "Autorización tramitada"';
COMMENT ON COLUMN pagos_candidato.precio_autorizacion         IS 'Precio de autorización (si se ha pagado)';
COMMENT ON COLUMN pagos_candidato.importe_formacion_actual    IS 'Importe por formación actual';
COMMENT ON COLUMN pagos_candidato.importe_formaciones_previas IS 'Importe por formaciones previas';
COMMENT ON COLUMN pagos_candidato.importe_piso_gw             IS 'Importe Piso GW';
COMMENT ON COLUMN pagos_candidato.importe_devolucion_ayuda    IS 'Importe Devolución Ayuda Estudio';
COMMENT ON COLUMN pagos_candidato.importe_autorizacion        IS 'Autorización (si se ha pagado y no debe el total)';
COMMENT ON COLUMN pagos_candidato.importe_total               IS 'Importe total a cobrar al candidato';
COMMENT ON COLUMN pagos_candidato.fecha_cobro                 IS 'Fecha cobro';
COMMENT ON COLUMN pagos_candidato.importe_pagado_2024         IS 'Importe pagado en 2024';
COMMENT ON COLUMN pagos_candidato.importe_pagado_2025         IS 'Importe pagado en 2025';
COMMENT ON COLUMN pagos_candidato.importe_pagado_2026         IS 'Importe pagado en 2026';
COMMENT ON COLUMN pagos_candidato.importe_pendiente           IS 'Importe pendiente de pago';
COMMENT ON COLUMN pagos_candidato.condiciones_pago            IS 'Condiciones de pago según contrato / Modo de devolución';
COMMENT ON COLUMN pagos_candidato.fecha_notificacion          IS 'Fecha de notificación de la cantidad pendiente de abono';
COMMENT ON COLUMN pagos_candidato.comentarios_coordinadores   IS 'Comentarios coordinadores';
COMMENT ON COLUMN pagos_candidato.comentarios_contabilidad    IS 'Comentarios contabilidad';
COMMENT ON COLUMN pagos_candidato.promociones_anteriores      IS 'Array JSONB de promociones anteriores [{promo, anexo_firmado, precio}]';

-- 3. promotions — state counts from Resumen tab / candidate sync
ALTER TABLE promotions
  ADD COLUMN IF NOT EXISTS total_training_finished  int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_to_place           int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_assigned           int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_offer_withdrawn    int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_expelled           int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_offer_declined     int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_approved_by_client int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_rejected_by_client int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_transferred        int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_stand_by           int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_next_project       int DEFAULT 0;

COMMENT ON COLUMN promotions.total_training_finished  IS 'Candidates with status Training Finished';
COMMENT ON COLUMN promotions.total_to_place           IS 'Candidates with status To Place';
COMMENT ON COLUMN promotions.total_assigned           IS 'Candidates with status Assigned';
COMMENT ON COLUMN promotions.total_offer_withdrawn    IS 'Candidates with status Offer-Withdrawn';
COMMENT ON COLUMN promotions.total_expelled           IS 'Candidates with status Expelled';
COMMENT ON COLUMN promotions.total_offer_declined     IS 'Candidates with status Offer-Declined';
COMMENT ON COLUMN promotions.total_approved_by_client IS 'Candidates approved by client';
COMMENT ON COLUMN promotions.total_rejected_by_client IS 'Candidates rejected by client';
COMMENT ON COLUMN promotions.total_transferred        IS 'Candidates with status Transferred';
COMMENT ON COLUMN promotions.total_stand_by           IS 'Candidates on stand-by';
COMMENT ON COLUMN promotions.total_next_project       IS 'Candidates marked for next project';

-- 4. New table: curso_desarrollo
-- Each row = one training session; multiple rows per promotion.
CREATE TABLE IF NOT EXISTS curso_desarrollo (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promocion_nombre   text,
  coordinador        text,
  session_name       text NOT NULL,
  duration_hours     numeric(5,2),
  session_date       date,
  session_time       text,
  instructor         text,
  promo_total_people integer,
  attendees_count    integer,
  total_attendees    integer,
  attendance_pct     numeric(5,4),
  survey_sent        boolean,
  session_language   text,
  session_link       text,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS curso_desarrollo_promo_idx ON curso_desarrollo(promocion_nombre);
CREATE INDEX IF NOT EXISTS curso_desarrollo_date_idx  ON curso_desarrollo(session_date);

ALTER TABLE curso_desarrollo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read" ON curso_desarrollo FOR SELECT USING (true);

COMMENT ON TABLE curso_desarrollo IS
  'Training sessions from tab "Curso Desarrollo" of Excel Madre. Each row = one session.';

COMMIT;
