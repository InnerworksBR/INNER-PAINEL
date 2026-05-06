-- migration_003.sql
-- Produção mínima funcional: schema usado pelo código atual e status de integrações

-- Servidores: campos exibidos na tela de monitoramento.
ALTER TABLE servers ADD COLUMN IF NOT EXISTS memory_total FLOAT DEFAULT 0;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS memory_used FLOAT DEFAULT 0;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS disk_total FLOAT DEFAULT 0;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS disk_used FLOAT DEFAULT 0;

-- GLPI por empresa: evita colisão quando IDs se repetem entre entidades/empresas.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'glpi_tickets_glpi_id_unique'
  ) THEN
    ALTER TABLE glpi_tickets DROP CONSTRAINT glpi_tickets_glpi_id_unique;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'glpi_tickets_company_glpi_id_unique'
  ) THEN
    ALTER TABLE glpi_tickets
      ADD CONSTRAINT glpi_tickets_company_glpi_id_unique UNIQUE (company_id, glpi_id);
  END IF;
END $$;

-- Constraints usadas por upserts.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ms365_metrics_company_license_unique'
  ) THEN
    ALTER TABLE ms365_metrics
      ADD CONSTRAINT ms365_metrics_company_license_unique UNIQUE (company_id, license_name);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'servers_company_hostname_unique'
  ) THEN
    ALTER TABLE servers
      ADD CONSTRAINT servers_company_hostname_unique UNIQUE (company_id, hostname);
  END IF;
END $$;

-- Campos extras de chamados.
ALTER TABLE glpi_tickets ADD COLUMN IF NOT EXISTS priority TEXT;
ALTER TABLE glpi_tickets ADD COLUMN IF NOT EXISTS requester TEXT;
ALTER TABLE glpi_tickets ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE glpi_tickets ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE glpi_tickets ADD COLUMN IF NOT EXISTS resolution_date TIMESTAMP WITH TIME ZONE;

-- Rede.
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

ALTER TABLE network_devices ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'network_devices'
      AND policyname = 'Admins can do everything on network'
  ) THEN
    CREATE POLICY "Admins can do everything on network" ON network_devices FOR ALL USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'network_devices'
      AND policyname = 'Clients view own network'
  ) THEN
    CREATE POLICY "Clients view own network" ON network_devices FOR SELECT USING (
      company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    );
  END IF;
END $$;

-- Configurações funcionais.
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'system_settings'
      AND policyname = 'Admins manage settings'
  ) THEN
    CREATE POLICY "Admins manage settings" ON system_settings FOR ALL USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;
END $$;

INSERT INTO system_settings (key, value)
VALUES
  ('systemName', 'Portal Inner'),
  ('baseUrl', ''),
  ('sessionTimeout', '30'),
  ('maintenanceMode', 'false'),
  ('detailedLogs', 'false')
ON CONFLICT (key) DO NOTHING;

-- Integrações: entidade GLPI e observabilidade de sync.
ALTER TABLE company_integrations ADD COLUMN IF NOT EXISTS glpi_entity_id INTEGER;
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

ALTER TABLE ms365_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE glpi_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
