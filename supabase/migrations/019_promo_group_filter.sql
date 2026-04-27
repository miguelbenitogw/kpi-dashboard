-- Allow multiple promos per sheet by filtering rows by a "Group" column.
-- Each promo_sheets_kpi row represents (sheet_url, group_filter) pair.
-- Existing rows get group_filter = '' (keeps 1:1 behavior for legacy sheets).

ALTER TABLE public.promo_sheets_kpi
  ADD COLUMN group_filter TEXT NOT NULL DEFAULT '';

ALTER TABLE public.promo_sheets_kpi
  DROP CONSTRAINT promo_sheets_sheet_url_key;

ALTER TABLE public.promo_sheets_kpi
  ADD CONSTRAINT promo_sheets_url_group_key UNIQUE (sheet_url, group_filter);

COMMENT ON COLUMN public.promo_sheets_kpi.group_filter IS
  'When non-empty, the importer only processes rows whose "Group" column matches this value. Allows one sheet to feed multiple promos.';
