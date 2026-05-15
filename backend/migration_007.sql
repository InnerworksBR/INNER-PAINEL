-- migration_007.sql
-- Permite escolher manualmente quais licenças entram nos indicadores executivos do Microsoft 365.

ALTER TABLE ms365_metrics
  ADD COLUMN IF NOT EXISTS include_in_dashboard BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE ms365_metrics
SET include_in_dashboard = TRUE
WHERE total <= 10005
  AND (
    lower(license_name) LIKE '%business%'
    OR lower(license_name) LIKE '%exchange%'
    OR lower(license_name) LIKE '%power%'
    OR lower(license_name) LIKE '%premium%'
    OR lower(license_name) LIKE '%standard%'
    OR lower(license_name) LIKE '%enterprise%'
    OR lower(license_name) LIKE '%visio%'
    OR lower(license_name) LIKE '%project%'
    OR lower(license_name) LIKE '%e3%'
    OR lower(license_name) LIKE '%e5%'
  )
  AND NOT (
    lower(license_name) LIKE '%free%'
    OR lower(license_name) LIKE '%exploratory%'
    OR lower(license_name) LIKE '%audit%'
    OR lower(license_name) LIKE '%compliance%'
    OR lower(license_name) LIKE '%security%'
    OR lower(license_name) LIKE '%defender%'
    OR lower(license_name) LIKE '%teams%'
    OR lower(license_name) LIKE '%virtual%'
    OR lower(license_name) LIKE '%stream%'
  );

CREATE INDEX IF NOT EXISTS ms365_metrics_company_dashboard_idx
  ON ms365_metrics (company_id, include_in_dashboard);
