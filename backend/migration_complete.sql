-- =============================================================================
-- MIGRATION COMPLETA: INNER_PAINEL
-- Consolidação de todas as migrations para setup inicial do Supabase Local
-- Execute este arquivo uma única vez no console SQL do Supabase
-- =============================================================================

-- =============================================================================
-- 001: Correções de constraints + novas tabelas
-- =============================================================================

-- UNIQUE constraints faltantes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'glpi_tickets_company_glpi_id_unique'
  ) THEN
    -- Se existir a constraint antiga, remove
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'glpi_tickets_glpi_id_unique') THEN
      ALTER TABLE glpi_tickets DROP CONSTRAINT glpi_tickets_glpi_id_unique;
    END IF;
    ALTER TABLE glpi_tickets ADD CONSTRAINT glpi_tickets_company_glpi_id_unique UNIQUE (company_id, glpi_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ms365_metrics_company_license_unique'
  ) THEN
    ALTER TABLE ms365_metrics ADD CONSTRAINT ms365_metrics_company_license_unique UNIQUE (company_id, license_name);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'servers_company_hostname_unique'
  ) THEN
    ALTER TABLE servers ADD CONSTRAINT servers_company_hostname_unique UNIQUE (company_id, hostname);
  END IF;
END $$;

-- Colunas extras em glpi_tickets
ALTER TABLE glpi_tickets ADD COLUMN IF NOT EXISTS priority TEXT;
ALTER TABLE glpi_tickets ADD COLUMN IF NOT EXISTS requester TEXT;
ALTER TABLE glpi_tickets ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE glpi_tickets ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE glpi_tickets ADD COLUMN IF NOT EXISTS resolution_date TIMESTAMP WITH TIME ZONE;

-- =============================================================================
-- 002: Refatoração GLPI para instância única backend
-- =============================================================================

ALTER TABLE company_integrations ADD COLUMN IF NOT EXISTS glpi_entity_id INTEGER;
COMMENT ON COLUMN company_integrations.glpi_entity_id IS 'ID da entidade deste cliente no GLPI unificado da operadora';

-- =============================================================================
-- 003: Produção mínima funcional + schema completo
-- =============================================================================

-- Servidores: campos de monitoramento
ALTER TABLE servers ADD COLUMN IF NOT EXISTS memory_total FLOAT DEFAULT 0;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS memory_used FLOAT DEFAULT 0;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS disk_total FLOAT DEFAULT 0;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS disk_used FLOAT DEFAULT 0;

-- Tabela network_devices
CREATE TABLE IF NOT EXISTS network_devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  device_name TEXT NOT NULL,
  device_type TEXT DEFAULT 'Outro',
  location TEXT,
  ip_address TEXT,
  uptime_percent FLOAT DEFAULT 0,
  status TEXT DEFAULT 'Online',
  contract_ref TEXT,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT network_devices_company_device_unique UNIQUE (company_id, device_name)
);

-- Tabela system_settings
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Configurações iniciais
INSERT INTO system_settings (key, value) VALUES
  ('systemName', 'Portal Inner'),
  ('baseUrl', ''),
  ('sessionTimeout', '30'),
  ('maintenanceMode', 'false'),
  ('detailedLogs', 'false')
ON CONFLICT (key) DO NOTHING;

-- Tabela monitoring_events
CREATE TABLE IF NOT EXISTS monitoring_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('server', 'network')),
  entity_name TEXT NOT NULL,
  entity_type TEXT,
  previous_status TEXT,
  current_status TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS monitoring_events_company_source_created_idx
  ON monitoring_events (company_id, source, created_at DESC);

-- Tabela admin_audit_logs
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  admin_email TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  summary TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS admin_audit_logs_created_idx ON admin_audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_logs_filters_idx ON admin_audit_logs (action, entity_type, company_id, created_at DESC);

-- Tabela server_metric_history
CREATE TABLE IF NOT EXISTS server_metric_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  server_id UUID REFERENCES servers(id) ON DELETE SET NULL,
  hostname TEXT NOT NULL,
  cpu_usage FLOAT DEFAULT 0,
  memory_usage FLOAT DEFAULT 0,
  disk_usage FLOAT DEFAULT 0,
  memory_total FLOAT DEFAULT 0,
  memory_used FLOAT DEFAULT 0,
  disk_total FLOAT DEFAULT 0,
  disk_used FLOAT DEFAULT 0,
  status TEXT DEFAULT 'Online',
  collected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS server_metric_history_lookup_idx
  ON server_metric_history (company_id, hostname, collected_at DESC);

-- Tabela network_status_history
CREATE TABLE IF NOT EXISTS network_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  network_device_id UUID REFERENCES network_devices(id) ON DELETE SET NULL,
  device_name TEXT NOT NULL,
  device_type TEXT,
  ip_address TEXT,
  status TEXT DEFAULT 'Online',
  collected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS network_status_history_lookup_idx
  ON network_status_history (company_id, device_name, collected_at DESC);

-- Profiles: controle operacional
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Company integrations: sync tracking
ALTER TABLE company_integrations ADD COLUMN IF NOT EXISTS ms365_last_sync_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE company_integrations ADD COLUMN IF NOT EXISTS ms365_last_sync_error TEXT;
ALTER TABLE company_integrations ADD COLUMN IF NOT EXISTS ms365_last_sync_count INTEGER DEFAULT 0;
ALTER TABLE company_integrations ADD COLUMN IF NOT EXISTS zabbix_last_sync_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE company_integrations ADD COLUMN IF NOT EXISTS zabbix_last_sync_error TEXT;
ALTER TABLE company_integrations ADD COLUMN IF NOT EXISTS zabbix_last_sync_count INTEGER DEFAULT 0;
ALTER TABLE company_integrations ADD COLUMN IF NOT EXISTS zabbix_network_last_sync_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE company_integrations ADD COLUMN IF NOT EXISTS zabbix_network_last_sync_error TEXT;
ALTER TABLE company_integrations ADD COLUMN IF NOT EXISTS zabbix_network_last_sync_count INTEGER DEFAULT 0;
ALTER TABLE company_integrations ADD COLUMN IF NOT EXISTS glpi_last_sync_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE company_integrations ADD COLUMN IF NOT EXISTS glpi_last_sync_error TEXT;
ALTER TABLE company_integrations ADD COLUMN IF NOT EXISTS glpi_last_sync_count INTEGER DEFAULT 0;

-- =============================================================================
-- 004: Observabilidade da coleta Zabbix por servidor
-- =============================================================================

ALTER TABLE servers ADD COLUMN IF NOT EXISTS zabbix_host_id TEXT;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS zabbix_last_data_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS zabbix_agent_available BOOLEAN;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS zabbix_sync_warning TEXT;

CREATE INDEX IF NOT EXISTS servers_company_zabbix_host_idx ON servers (company_id, zabbix_host_id);

-- =============================================================================
-- 005: Inventário técnico de ativos (asset_profiles)
-- =============================================================================

CREATE TABLE IF NOT EXISTS asset_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('server', 'network_device')),
  source_id UUID NOT NULL,
  asset_type TEXT NOT NULL DEFAULT 'outro',
  display_name TEXT,
  customer_visible BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  include_in_health_score BOOLEAN NOT NULL DEFAULT TRUE,
  manufacturer TEXT,
  model TEXT,
  serial_number TEXT,
  operating_system TEXT,
  operating_system_version TEXT,
  firmware_version TEXT,
  physical_or_virtual TEXT,
  business_purpose TEXT,
  technical_purpose TEXT,
  environment TEXT,
  criticality TEXT,
  location TEXT,
  notes_for_customer TEXT,
  auto_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  manual_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  manual_override_fields TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  last_synced_at TIMESTAMP WITH TIME ZONE,
  last_reviewed_at TIMESTAMP WITH TIME ZONE,
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT asset_profiles_source_unique UNIQUE (company_id, source_type, source_id)
);

CREATE INDEX IF NOT EXISTS asset_profiles_company_idx ON asset_profiles (company_id);
CREATE INDEX IF NOT EXISTS asset_profiles_source_idx ON asset_profiles (source_type, source_id);
CREATE INDEX IF NOT EXISTS asset_profiles_company_visibility_idx ON asset_profiles (company_id, customer_visible);
CREATE INDEX IF NOT EXISTS asset_profiles_company_health_idx ON asset_profiles (company_id, include_in_health_score);

-- =============================================================================
-- 006: ms365_metrics - include_in_dashboard
-- =============================================================================

ALTER TABLE ms365_metrics ADD COLUMN IF NOT EXISTS include_in_dashboard BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS ms365_metrics_company_dashboard_idx ON ms365_metrics (company_id, include_in_dashboard);

-- Atualiza licenças padrão para dashboard
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

-- =============================================================================
-- 007: Security Reports
-- =============================================================================

CREATE TABLE IF NOT EXISTS security_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL CHECK (report_type IN ('zero_trust', 'simplified')),
  title TEXT NOT NULL DEFAULT '',
  file_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (company_id, report_type)
);

-- =============================================================================
-- 008: Agentes Nativos Inner (impl. 010)
-- =============================================================================

CREATE TABLE IF NOT EXISTS agent_activation_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  label TEXT DEFAULT 'Token Padrão',
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS agent_activation_tokens_company_idx ON agent_activation_tokens (company_id, is_active);

CREATE TABLE IF NOT EXISTS registered_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  agent_type TEXT NOT NULL CHECK (agent_type IN ('endpoint', 'collector')),
  asset_key TEXT NOT NULL UNIQUE,
  agent_secret TEXT NOT NULL,
  hostname TEXT NOT NULL,
  ip_address TEXT,
  os_info TEXT,
  os_version VARCHAR(100),
  hypervisor VARCHAR(50),
  version TEXT DEFAULT '1.0.0',
  status TEXT NOT NULL DEFAULT 'Online',
  last_heartbeat TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS registered_agents_company_idx ON registered_agents (company_id);
CREATE INDEX IF NOT EXISTS registered_agents_asset_key_idx ON registered_agents (asset_key);

-- Extensões em servers para agentes
ALTER TABLE servers ADD COLUMN IF NOT EXISTS monitoring_source TEXT DEFAULT 'zabbix';
ALTER TABLE servers ADD COLUMN IF NOT EXISTS asset_key TEXT;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES registered_agents(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'servers_asset_key_unique') THEN
    ALTER TABLE servers ADD CONSTRAINT servers_asset_key_unique UNIQUE (asset_key);
  END IF;
END $$;

-- Extensões em network_devices para agentes e SNMP
ALTER TABLE network_devices ADD COLUMN IF NOT EXISTS monitoring_source TEXT DEFAULT 'zabbix';
ALTER TABLE network_devices ADD COLUMN IF NOT EXISTS asset_key TEXT;
ALTER TABLE network_devices ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES registered_agents(id) ON DELETE SET NULL;
ALTER TABLE network_devices ADD COLUMN IF NOT EXISTS snmp_data JSONB DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'network_devices_asset_key_unique') THEN
    ALTER TABLE network_devices ADD CONSTRAINT network_devices_asset_key_unique UNIQUE (asset_key);
  END IF;
END $$;

-- =============================================================================
-- 009: Monitoramento Descentralizado - agent_metrics e snmp_collectors
-- =============================================================================

CREATE TABLE IF NOT EXISTS agent_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES registered_agents(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  host_cpu_percent DECIMAL(5,2) DEFAULT 0,
  host_memory_percent DECIMAL(5,2) DEFAULT 0,
  host_memory_total_mb INTEGER DEFAULT 0,
  host_memory_used_mb INTEGER DEFAULT 0,
  host_disk_percent DECIMAL(5,2) DEFAULT 0,
  host_disk_total_gb DECIMAL(10,2) DEFAULT 0,
  host_disk_used_gb DECIMAL(10,2) DEFAULT 0,
  host_uptime_seconds BIGINT DEFAULT 0,
  virtual_machines JSONB DEFAULT '[]'::jsonb,
  collected_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  partial BOOLEAN DEFAULT FALSE,
  idempotency_key VARCHAR(255) UNIQUE,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_agent_metrics_agent_time ON agent_metrics (agent_id, collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_metrics_company_time ON agent_metrics (company_id, collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_metrics_collected_at ON agent_metrics (collected_at DESC);

CREATE TABLE IF NOT EXISTS snmp_collectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  collector_host VARCHAR(255),
  ip_range_start INET,
  ip_range_end INET,
  community_string VARCHAR(255),
  snmp_version VARCHAR(10) DEFAULT '2c',
  snmp_port INTEGER DEFAULT 161,
  enabled BOOLEAN DEFAULT TRUE,
  interval_seconds INTEGER DEFAULT 300,
  last_run_at TIMESTAMPTZ,
  last_run_duration_ms INTEGER,
  last_devices_found INTEGER DEFAULT 0,
  last_status VARCHAR(50),
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, name)
);

CREATE INDEX IF NOT EXISTS idx_snmp_collectors_company ON snmp_collectors (company_id);
CREATE INDEX IF NOT EXISTS idx_snmp_collectors_enabled ON snmp_collectors (enabled) WHERE enabled = TRUE;

-- Extensões em servers para estrutura Host/VM
ALTER TABLE servers ADD COLUMN IF NOT EXISTS vm_parent_id UUID REFERENCES servers(id) ON DELETE SET NULL;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS is_virtual BOOLEAN DEFAULT FALSE;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS vm_cpu_percent DECIMAL(5,2);
ALTER TABLE servers ADD COLUMN IF NOT EXISTS vm_memory_percent DECIMAL(5,2);
ALTER TABLE servers ADD COLUMN IF NOT EXISTS vm_memory_total_mb INTEGER;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS vm_status VARCHAR(50);

-- Extensões em network_devices para SNMP
ALTER TABLE network_devices ADD COLUMN IF NOT EXISTS snmp_collector_id UUID REFERENCES snmp_collectors(id) ON DELETE SET NULL;
ALTER TABLE network_devices ADD COLUMN IF NOT EXISTS snmp_uptime BIGINT;
ALTER TABLE network_devices ADD COLUMN IF NOT EXISTS snmp_last_poll TIMESTAMPTZ;
ALTER TABLE network_devices ADD COLUMN IF NOT EXISTS snmp_sysdescr TEXT;
ALTER TABLE network_devices ADD COLUMN IF NOT EXISTS snmp_if_count INTEGER;
ALTER TABLE network_devices ADD COLUMN IF NOT EXISTS snmp_community VARCHAR(255);

-- =============================================================================
-- 010: Arquivar dados Zabbix (impl. 019)
-- =============================================================================

ALTER TABLE servers ADD COLUMN IF NOT EXISTS zabbix_archived_at TIMESTAMPTZ;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS zabbix_data JSONB;

ALTER TABLE network_devices ADD COLUMN IF NOT EXISTS zabbix_archived_at TIMESTAMPTZ;
ALTER TABLE network_devices ADD COLUMN IF NOT EXISTS zabbix_data JSONB;

-- Migrar dados Zabbix para campo archived (servers)
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

-- Migrar dados Zabbix para campo archived (network_devices)
UPDATE network_devices
SET zabbix_data = jsonb_build_object(
      'status', status,
      'uptime_percent', uptime_percent,
      'zabbix_last_check', last_updated
    ),
    zabbix_archived_at = NOW()
WHERE monitoring_source = 'zabbix'
  AND zabbix_archived_at IS NULL;

-- Atualizar monitoring_source para 'archived'
UPDATE servers
SET monitoring_source = 'archived'
WHERE zabbix_archived_at IS NOT NULL
  AND monitoring_source = 'zabbix';

UPDATE network_devices
SET monitoring_source = 'archived'
WHERE zabbix_archived_at IS NOT NULL
  AND monitoring_source = 'zabbix';

-- Tabela de backup Zabbix
CREATE TABLE IF NOT EXISTS zabbix_backup (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  original_id UUID,
  data JSONB NOT NULL,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_zabbix_backup_table_name ON zabbix_backup (table_name);
CREATE INDEX IF NOT EXISTS idx_zabbix_backup_original_id ON zabbix_backup (original_id);
CREATE INDEX IF NOT EXISTS idx_zabbix_backup_archived_at ON zabbix_backup (archived_at DESC);

-- =============================================================================
-- 011: RLS - Habilitar e criar políticas
-- =============================================================================

-- Habilitar RLS
ALTER TABLE network_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE server_metric_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE network_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_activation_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE registered_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE snmp_collectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE zabbix_backup ENABLE ROW LEVEL SECURITY;
ALTER TABLE ms365_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE glpi_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Policies: system_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'system_settings' AND policyname = 'Admins manage settings'
  ) THEN
    CREATE POLICY "Admins manage settings" ON system_settings FOR ALL USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;
END $$;

-- Policies: network_devices
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'network_devices' AND policyname = 'Admins can do everything on network'
  ) THEN
    CREATE POLICY "Admins can do everything on network" ON network_devices FOR ALL USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'network_devices' AND policyname = 'Clients view own network'
  ) THEN
    CREATE POLICY "Clients view own network" ON network_devices FOR SELECT USING (
      company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    );
  END IF;
END $$;

-- Policies: monitoring_events
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'monitoring_events' AND policyname = 'Admins can do everything on monitoring events'
  ) THEN
    CREATE POLICY "Admins can do everything on monitoring events" ON monitoring_events FOR ALL USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'monitoring_events' AND policyname = 'Clients view own monitoring events'
  ) THEN
    CREATE POLICY "Clients view own monitoring events" ON monitoring_events FOR SELECT USING (
      company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    );
  END IF;
END $$;

-- Policies: admin_audit_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'admin_audit_logs' AND policyname = 'Admins can view audit logs'
  ) THEN
    CREATE POLICY "Admins can view audit logs" ON admin_audit_logs FOR SELECT USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'admin_audit_logs' AND policyname = 'Admins can insert audit logs'
  ) THEN
    CREATE POLICY "Admins can insert audit logs" ON admin_audit_logs FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;
END $$;

-- Policies: server_metric_history
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'server_metric_history' AND policyname = 'Admins can do everything on server history'
  ) THEN
    CREATE POLICY "Admins can do everything on server history" ON server_metric_history FOR ALL USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'server_metric_history' AND policyname = 'Clients view own server history'
  ) THEN
    CREATE POLICY "Clients view own server history" ON server_metric_history FOR SELECT USING (
      company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    );
  END IF;
END $$;

-- Policies: network_status_history
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'network_status_history' AND policyname = 'Admins can do everything on network history'
  ) THEN
    CREATE POLICY "Admins can do everything on network history" ON network_status_history FOR ALL USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'network_status_history' AND policyname = 'Clients view own network history'
  ) THEN
    CREATE POLICY "Clients view own network history" ON network_status_history FOR SELECT USING (
      company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    );
  END IF;
END $$;

-- Policies: asset_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'asset_profiles' AND policyname = 'Admins can do everything on asset profiles'
  ) THEN
    CREATE POLICY "Admins can do everything on asset profiles" ON asset_profiles FOR ALL USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'asset_profiles' AND policyname = 'Clients view own visible asset profiles'
  ) THEN
    CREATE POLICY "Clients view own visible asset profiles" ON asset_profiles FOR SELECT USING (
      customer_visible = TRUE
      AND company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    );
  END IF;
END $$;

-- Policies: security_reports
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'security_reports' AND policyname = 'admins_security_all'
  ) THEN
    CREATE POLICY "admins_security_all" ON security_reports FOR ALL USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'security_reports' AND policyname = 'clients_security_select'
  ) THEN
    CREATE POLICY "clients_security_select" ON security_reports FOR SELECT USING (
      company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    );
  END IF;
END $$;

-- Policies: agent_activation_tokens
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'agent_activation_tokens' AND policyname = 'Admins manage activation tokens'
  ) THEN
    CREATE POLICY "Admins manage activation tokens" ON agent_activation_tokens FOR ALL USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;
END $$;

-- Policies: registered_agents
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'registered_agents' AND policyname = 'Admins manage registered agents'
  ) THEN
    CREATE POLICY "Admins manage registered agents" ON registered_agents FOR ALL USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'registered_agents' AND policyname = 'Clients view own registered agents'
  ) THEN
    CREATE POLICY "Clients view own registered agents" ON registered_agents FOR SELECT USING (
      company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    );
  END IF;
END $$;

-- Policies: agent_metrics
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'agent_metrics' AND policyname = 'Admins manage agent_metrics'
  ) THEN
    CREATE POLICY "Admins manage agent_metrics" ON agent_metrics FOR ALL USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;
END $$;

-- Policies: snmp_collectors
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'snmp_collectors' AND policyname = 'Admins manage snmp_collectors'
  ) THEN
    CREATE POLICY "Admins manage snmp_collectors" ON snmp_collectors FOR ALL USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;
END $$;

-- Policies: zabbix_backup
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'zabbix_backup' AND policyname = 'Admins can manage zabbix_backup'
  ) THEN
    CREATE POLICY "Admins can manage zabbix_backup" ON zabbix_backup FOR ALL USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;
END $$;

-- Policies: ms365_metrics
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ms365_metrics' AND policyname = 'Admins can do everything on ms365'
  ) THEN
    CREATE POLICY "Admins can do everything on ms365" ON ms365_metrics FOR ALL USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ms365_metrics' AND policyname = 'Clients view own ms365'
  ) THEN
    CREATE POLICY "Clients view own ms365" ON ms365_metrics FOR SELECT USING (
      company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    );
  END IF;
END $$;

-- Policies: servers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'servers' AND policyname = 'Admins can do everything on servers'
  ) THEN
    CREATE POLICY "Admins can do everything on servers" ON servers FOR ALL USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'servers' AND policyname = 'Clients view own servers'
  ) THEN
    CREATE POLICY "Clients view own servers" ON servers FOR SELECT USING (
      company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    );
  END IF;
END $$;

-- Policies: glpi_tickets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'glpi_tickets' AND policyname = 'Admins can do everything on tickets'
  ) THEN
    CREATE POLICY "Admins can do everything on tickets" ON glpi_tickets FOR ALL USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'glpi_tickets' AND policyname = 'Clients view own tickets'
  ) THEN
    CREATE POLICY "Clients view own tickets" ON glpi_tickets FOR SELECT USING (
      company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    );
  END IF;
END $$;

-- Policies: documents
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'documents' AND policyname = 'Admins can do everything on documents'
  ) THEN
    CREATE POLICY "Admins can do everything on documents" ON documents FOR ALL USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'documents' AND policyname = 'Clients view own documents'
  ) THEN
    CREATE POLICY "Clients view own documents" ON documents FOR SELECT USING (
      company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    );
  END IF;
END $$;

-- Policy: profiles - usuários veem seu próprio perfil
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Users can view own profile'
  ) THEN
    CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (
      id = auth.uid()
    );
  END IF;
END $$;

-- =============================================================================
-- 012: Comments para documentação
-- =============================================================================

COMMENT ON TABLE glpi_tickets IS 'Espelho atual dos chamados sincronizados do GLPI por empresa';
COMMENT ON TABLE agent_metrics IS 'Métricas históricas de agentes de monitoramento (host físico + VMs)';
COMMENT ON TABLE snmp_collectors IS 'Configuração de coletores SNMP por empresa';
COMMENT ON TABLE zabbix_backup IS 'Backup dos dados migrados do Zabbix antes da descontinuação';
COMMENT ON COLUMN agent_metrics.virtual_machines IS 'Array JSON de VMs: [{name, cpu_percent, memory_percent, status, ...}]';
COMMENT ON COLUMN snmp_collectors.community_string IS 'Community string SNMP. MVP: texto plano. Futuro: migrar para cofre (impl. 018)';
COMMENT ON COLUMN servers.zabbix_data IS 'Dados históricos do Zabbix migrados antes da descontinuação (JSONB)';
COMMENT ON COLUMN servers.zabbix_archived_at IS 'Timestamp de arquivo do registro Zabbix';
COMMENT ON COLUMN servers.monitoring_source IS 'Fonte de monitoramento: zabbix (antigo), agent, snmp, archived';

-- =============================================================================
-- FIM DA MIGRATION
-- Execute no SQL Editor do Supabase Local
-- =============================================================================
