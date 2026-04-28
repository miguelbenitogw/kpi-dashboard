-- Base Global Placement columns missing from earlier migrations
ALTER TABLE candidates_kpi
  ADD COLUMN IF NOT EXISTS hpr_number          text,
  ADD COLUMN IF NOT EXISTS hospitering_dates   text,
  ADD COLUMN IF NOT EXISTS placement_client    text,
  ADD COLUMN IF NOT EXISTS placement_location  text,
  ADD COLUMN IF NOT EXISTS flight_date         date,
  ADD COLUMN IF NOT EXISTS placement_date      date;
