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

-- Usuários: controle operacional básico.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

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

-- Eventos de monitoramento: histórico de queda/retorno e alertas simples.
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

ALTER TABLE monitoring_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'monitoring_events'
      AND policyname = 'Admins can do everything on monitoring events'
  ) THEN
    CREATE POLICY "Admins can do everything on monitoring events" ON monitoring_events FOR ALL USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'monitoring_events'
      AND policyname = 'Clients view own monitoring events'
  ) THEN
    CREATE POLICY "Clients view own monitoring events" ON monitoring_events FOR SELECT USING (
      company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    );
  END IF;
END $$;

-- Auditoria administrativa.
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

CREATE INDEX IF NOT EXISTS admin_audit_logs_created_idx
  ON admin_audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS admin_audit_logs_filters_idx
  ON admin_audit_logs (action, entity_type, company_id, created_at DESC);

ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'admin_audit_logs'
      AND policyname = 'Admins can view audit logs'
  ) THEN
    CREATE POLICY "Admins can view audit logs" ON admin_audit_logs FOR SELECT USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'admin_audit_logs'
      AND policyname = 'Admins can insert audit logs'
  ) THEN
    CREATE POLICY "Admins can insert audit logs" ON admin_audit_logs FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;
END $$;

-- Histórico simples de monitoramento.
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

ALTER TABLE server_metric_history ENABLE ROW LEVEL SECURITY;

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

ALTER TABLE network_status_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'server_metric_history'
      AND policyname = 'Admins can do everything on server history'
  ) THEN
    CREATE POLICY "Admins can do everything on server history" ON server_metric_history FOR ALL USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'server_metric_history'
      AND policyname = 'Clients view own server history'
  ) THEN
    CREATE POLICY "Clients view own server history" ON server_metric_history FOR SELECT USING (
      company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'network_status_history'
      AND policyname = 'Admins can do everything on network history'
  ) THEN
    CREATE POLICY "Admins can do everything on network history" ON network_status_history FOR ALL USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'network_status_history'
      AND policyname = 'Clients view own network history'
  ) THEN
    CREATE POLICY "Clients view own network history" ON network_status_history FOR SELECT USING (
      company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    );
  END IF;
END $$;

ALTER TABLE ms365_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE glpi_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
