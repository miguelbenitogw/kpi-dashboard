-- Migration 003: Add category to job_openings
-- Classifies job openings into: atraccion, formacion, interna
-- This enables filtering promos (formacion) for the performance view.

-- ---------------------------------------------------------------------------
-- 1. Add column with default
-- ---------------------------------------------------------------------------
ALTER TABLE job_openings
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'atraccion';

-- ---------------------------------------------------------------------------
-- 2. CHECK constraint for valid values
-- ---------------------------------------------------------------------------
ALTER TABLE job_openings
  ADD CONSTRAINT job_openings_category_check
  CHECK (category IN ('atraccion', 'formacion', 'interna'));

-- ---------------------------------------------------------------------------
-- 3. Auto-classify existing rows based on title patterns
-- ---------------------------------------------------------------------------
UPDATE job_openings
SET category = 'formacion'
WHERE title ILIKE '%promo%';

-- Note: internal positions will be manually reclassified via the dashboard.

-- ---------------------------------------------------------------------------
-- 4. Index for fast category filtering
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS job_openings_category_idx
  ON job_openings (category);
