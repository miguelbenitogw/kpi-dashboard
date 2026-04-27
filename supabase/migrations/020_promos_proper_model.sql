-- Proper promo data model:
--   promotions_kpi          (source of truth for promos)
--   promo_job_link_kpi      (junction: 1 promo → N job_openings)
--   promo_sheets_kpi        (1 promo → N sheets / group_filters)
--   promo_students_kpi      (students per sheet)
--
-- Uses promocion_nombre (TEXT, already UNIQUE in promotions_kpi) as the
-- natural FK — avoids a UUID surrogate refactor and keeps the existing
-- Colocación UI working.

-- ── 1. Clean promotions_kpi ──────────────────────────────────────────────
-- These columns encode the broken 1:1 model (single Zoho link, single sheet).
-- Replaced by the junction + promo_sheets_kpi respectively.
ALTER TABLE public.promotions_kpi
  DROP COLUMN IF EXISTS zoho_job_opening_id,
  DROP COLUMN IF EXISTS sheet_url,
  DROP COLUMN IF EXISTS sheet_madre_row;

-- ── 2. Restructure promo_job_link_kpi for 1:N ────────────────────────────
-- Old PK was (promocion_nombre) — forced 1 job_opening per promo.
-- New PK (promocion_nombre, job_opening_id) allows N job_openings per promo.

ALTER TABLE public.promo_job_link_kpi
  DROP CONSTRAINT promo_job_link_pkey;

ALTER TABLE public.promo_job_link_kpi
  DROP CONSTRAINT promo_job_link_job_opening_id_fkey;

-- Both columns are now mandatory (a junction row must point somewhere).
ALTER TABLE public.promo_job_link_kpi
  ALTER COLUMN job_opening_id SET NOT NULL;

ALTER TABLE public.promo_job_link_kpi
  ADD CONSTRAINT promo_job_link_pkey PRIMARY KEY (promocion_nombre, job_opening_id);

ALTER TABLE public.promo_job_link_kpi
  ADD CONSTRAINT promo_job_link_promocion_nombre_fkey
  FOREIGN KEY (promocion_nombre) REFERENCES public.promotions_kpi(nombre)
  ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE public.promo_job_link_kpi
  ADD CONSTRAINT promo_job_link_job_opening_id_fkey
  FOREIGN KEY (job_opening_id) REFERENCES public.job_openings_kpi(id)
  ON DELETE CASCADE;

-- ── 3. Point promo_sheets_kpi at promotions_kpi, not job_openings ────────
-- A sheet now belongs to a promo; the promo carries the Zoho links.

ALTER TABLE public.promo_sheets_kpi
  DROP CONSTRAINT promo_sheets_job_opening_id_fkey;

ALTER TABLE public.promo_sheets_kpi
  ADD COLUMN promocion_nombre TEXT;

-- Drop the now-redundant column — the link lives in promo_job_link_kpi.
ALTER TABLE public.promo_sheets_kpi
  DROP COLUMN job_opening_id;

ALTER TABLE public.promo_sheets_kpi
  ADD CONSTRAINT promo_sheets_promocion_nombre_fkey
  FOREIGN KEY (promocion_nombre) REFERENCES public.promotions_kpi(nombre)
  ON UPDATE CASCADE ON DELETE RESTRICT;

-- A sheet registration without a promo is meaningless.
ALTER TABLE public.promo_sheets_kpi
  ALTER COLUMN promocion_nombre SET NOT NULL;

-- ── 4. Same treatment for promo_students_kpi ─────────────────────────────
-- The sheet already tells us the promo, but carrying it denormalized here
-- is cheap and makes analytics queries simpler.

ALTER TABLE public.promo_students_kpi
  ADD COLUMN promocion_nombre TEXT;

ALTER TABLE public.promo_students_kpi
  ADD CONSTRAINT promo_students_promocion_nombre_fkey
  FOREIGN KEY (promocion_nombre) REFERENCES public.promotions_kpi(nombre)
  ON UPDATE CASCADE ON DELETE CASCADE;

-- job_opening_id on promo_students_kpi stays nullable — it's now only
-- the specific job_opening the student was matched against (if any).

-- ── 5. Helpful indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_promo_sheets_promocion_nombre
  ON public.promo_sheets_kpi (promocion_nombre);

CREATE INDEX IF NOT EXISTS idx_promo_students_promocion_nombre
  ON public.promo_students_kpi (promocion_nombre);

CREATE INDEX IF NOT EXISTS idx_promo_job_link_job_opening_id
  ON public.promo_job_link_kpi (job_opening_id);
