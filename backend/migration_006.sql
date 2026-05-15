-- migration_006.sql
-- Permite excluir ativos da composição da saúde geral sem ocultá-los do cliente.

ALTER TABLE asset_profiles
  ADD COLUMN IF NOT EXISTS include_in_health_score BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS asset_profiles_company_health_idx
  ON asset_profiles (company_id, include_in_health_score);
