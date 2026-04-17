-- Migration 012: promo_job_link
-- Maps Excel Madre promo names ("Promoción 113") to Zoho job_openings.
-- Populated from the UI — coordinator selects the matching vacancy once.

CREATE TABLE IF NOT EXISTS promo_job_link (
  promocion_nombre  text        PRIMARY KEY,
  job_opening_id    text        REFERENCES job_openings(id) ON DELETE SET NULL,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

COMMENT ON TABLE promo_job_link IS
  'Links Excel Madre promo names to Zoho job_openings. Populated manually via the UI.';
