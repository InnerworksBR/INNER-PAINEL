-- migration_004.sql
-- Observabilidade da coleta Zabbix por servidor.

ALTER TABLE servers ADD COLUMN IF NOT EXISTS zabbix_host_id TEXT;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS zabbix_last_data_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS zabbix_agent_available BOOLEAN;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS zabbix_sync_warning TEXT;

CREATE INDEX IF NOT EXISTS servers_company_zabbix_host_idx
  ON servers (company_id, zabbix_host_id);
