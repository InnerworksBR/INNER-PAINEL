-- migration_012_archive_zabbix.sql
-- Monitoramento Descentralizado: Arquivar dados Zabbix existentes (impl. 019)
-- Dados são marcados como 'archived' ao invés de deletados

-- ============================================================
-- 1. Adicionar colunas de arquivo às tabelas existentes
-- ============================================================
ALTER TABLE servers ADD COLUMN IF NOT EXISTS zabbix_archived_at TIMESTAMPTZ;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS zabbix_data JSONB;

ALTER TABLE network_devices ADD COLUMN IF NOT EXISTS zabbix_archived_at TIMESTAMPTZ;
ALTER TABLE network_devices ADD COLUMN IF NOT EXISTS zabbix_data JSONB;

-- ============================================================
-- 2. Migrar dados Zabbix para campo archived (servers)
-- ============================================================
UPDATE servers
SET zabbix_data = jsonb_build_object(
      'cpu_usage', cpu_usage,
      'memory_usage', memory_usage,
      'disk_usage', disk_usage,
      'zabbix_last_check', last_updated
    ),
    zabbix_archived_at = NOW()
WHERE monitoring_source = 'zabbix'
  AND zabbix_archived_at IS NULL;

-- ============================================================
-- 3. Migrar dados Zabbix para campo archived (network_devices)
-- ============================================================
UPDATE network_devices
SET zabbix_data = jsonb_build_object(
      'status', status,
      'uptime_percent', uptime_percent,
      'zabbix_last_check', last_updated
    ),
    zabbix_archived_at = NOW()
WHERE monitoring_source = 'zabbix'
  AND zabbix_archived_at IS NULL;

-- ============================================================
-- 4. Atualizar monitoring_source para 'archived'
-- ============================================================
UPDATE servers
SET monitoring_source = 'archived'
WHERE zabbix_archived_at IS NOT NULL
  AND monitoring_source = 'zabbix';

UPDATE network_devices
SET monitoring_source = 'archived'
WHERE zabbix_archived_at IS NOT NULL
  AND monitoring_source = 'zabbix';

-- ============================================================
-- 5. Criar tabela de backup para dados Zabbix completos
-- ============================================================
CREATE TABLE IF NOT EXISTS zabbix_backup (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  original_id UUID,
  data JSONB NOT NULL,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para a tabela de backup
CREATE INDEX IF NOT EXISTS idx_zabbix_backup_table_name
  ON zabbix_backup (table_name);

CREATE INDEX IF NOT EXISTS idx_zabbix_backup_original_id
  ON zabbix_backup (original_id);

CREATE INDEX IF NOT EXISTS idx_zabbix_backup_archived_at
  ON zabbix_backup (archived_at DESC);

-- ============================================================
-- 6. RLS Policy para admins acessarem dados arquivados
-- ============================================================
ALTER TABLE zabbix_backup ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'zabbix_backup'
      AND policyname = 'Admins can manage zabbix_backup'
  ) THEN
    CREATE POLICY "Admins can manage zabbix_backup" ON zabbix_backup FOR ALL USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;
END $$;

-- ============================================================
-- 7. Comments para documentação
-- ============================================================
COMMENT ON TABLE zabbix_backup IS 'Backup dos dados migrados do Zabbix antes da descontinuacao';
COMMENT ON COLUMN servers.zabbix_data IS 'Dados historicos do Zabbix migrados antes da descontinuacao (JSONB)';
COMMENT ON COLUMN servers.zabbix_archived_at IS 'Timestamp de arquivo do registro Zabbix';
COMMENT ON COLUMN servers.monitoring_source IS 'Fonte de monitoramento: zabbix (antigo), agent, snmp, archived';
