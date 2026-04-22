-- Migration 021: Normalize promotion names + consolidate promotions_kpi
--
-- Problems fixed:
--   1. Duplicate rows: "P113" and "Promoción 113" existed for the same promo
--      because candidates_kpi.promocion_nombre was inconsistently formatted.
--   2. All metadata (modalidad, pais, coordinador, etc.) was NULL because
--      importResumen() wrote to promo_targets_kpi using the name as FK, but
--      the candidate names didn't match → no enrichment happened.
--   3. promo_targets_kpi was a staging table with 0 rows and no readers.
--      Fields are absorbed directly into promotions_kpi.
--   4. candidates_kpi.promotion_id (uuid) was referenced in code but the
--      column didn't exist in the DB schema.

-- ── 1. Normalize P### names in child tables (FK ON UPDATE CASCADE won't help
--       here because we need to re-point FROM duplicate TO canonical row) ────

UPDATE public.promo_sheets_kpi
SET promocion_nombre = 'Promoción ' || (regexp_match(promocion_nombre, '^\s*[Pp](\d+)\s*$'))[1]
WHERE promocion_nombre ~ '^\s*[Pp]\d+\s*$';

UPDATE public.promo_students_kpi
SET promocion_nombre = 'Promoción ' || (regexp_match(promocion_nombre, '^\s*[Pp](\d+)\s*$'))[1]
WHERE promocion_nombre ~ '^\s*[Pp]\d+\s*$';

UPDATE public.promo_job_link_kpi
SET promocion_nombre = 'Promoción ' || (regexp_match(promocion_nombre, '^\s*[Pp](\d+)\s*$'))[1]
WHERE promocion_nombre ~ '^\s*[Pp]\d+\s*$';

-- ── 2. Normalize candidates_kpi.promocion_nombre (plain text, no FK) ─────────

UPDATE public.candidates_kpi
SET promocion_nombre = 'Promoción ' || (regexp_match(promocion_nombre, '^\s*[Pp](\d+)\s*$'))[1]
WHERE promocion_nombre ~ '^\s*[Pp]\d+\s*$';

-- ── 3. Delete duplicate/garbage rows from promotions_kpi ──────────────────────
-- P### rows are now orphans (all references already re-pointed above)
DELETE FROM public.promotions_kpi
WHERE nombre ~ '^\s*[Pp]\d+\s*$';

-- Delete bare "Promoción" row (no number, garbage artifact)
DELETE FROM public.promotions_kpi
WHERE nombre = 'Promoción';

-- ── 4. Add pct_* and contratos_firmados fields (from promo_targets_kpi) ───────
ALTER TABLE public.promotions_kpi
  ADD COLUMN IF NOT EXISTS pct_consecucion_atraccion  numeric,
  ADD COLUMN IF NOT EXISTS pct_consecucion_programa   numeric,
  ADD COLUMN IF NOT EXISTS pct_exito_estimado         numeric,
  ADD COLUMN IF NOT EXISTS contratos_firmados         integer;

-- ── 5. Add promotion_id (uuid FK) to candidates_kpi ─────────────────────────
-- This was referenced in syncPromotionsFromCandidates() but didn't exist in DB.
ALTER TABLE public.candidates_kpi
  ADD COLUMN IF NOT EXISTS promotion_id uuid
  REFERENCES public.promotions_kpi(id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_candidates_kpi_promotion_id
  ON public.candidates_kpi (promotion_id);

-- ── 6. Drop promo_targets_kpi (0 rows — data now goes directly to promotions_kpi) ──
DROP TABLE IF EXISTS public.promo_targets_kpi;
