-- migration_011.sql
-- Monitoramento Descentralizado: agent_metrics, snmp_collectors, e extensões
-- Substitui integração Zabbix (impl. 013/019)

-- ============================================================
-- 1. Tabela agent_metrics — Métricas históricas de agentes
-- ============================================================
CREATE TABLE IF NOT EXISTS agent_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES registered_agents(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  -- Dados do host físico
  host_cpu_percent DECIMAL(5,2) DEFAULT 0,
  host_memory_percent DECIMAL(5,2) DEFAULT 0,
  host_memory_total_mb INTEGER DEFAULT 0,
  host_memory_used_mb INTEGER DEFAULT 0,
  host_disk_percent DECIMAL(5,2) DEFAULT 0,
  host_disk_total_gb DECIMAL(10,2) DEFAULT 0,
  host_disk_used_gb DECIMAL(10,2) DEFAULT 0,
  host_uptime_seconds BIGINT DEFAULT 0,
  -- VMs (JSONB para flexibilidade)
  virtual_machines JSONB DEFAULT '[]'::jsonb,
  -- Timestamps
  collected_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Integridade
  partial BOOLEAN DEFAULT FALSE,
  idempotency_key VARCHAR(255) UNIQUE,
  -- Metadados
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_agent_metrics_agent_time
  ON agent_metrics (agent_id, collected_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_metrics_company_time
  ON agent_metrics (company_id, collected_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_metrics_collected_at
  ON agent_metrics (collected_at DESC);

-- ============================================================
-- 2. Tabela snmp_collectors — Configuração de coletores SNMP
-- ============================================================
CREATE TABLE IF NOT EXISTS snmp_collectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  collector_host VARCHAR(255),                   -- IP do servidor com coletor
  ip_range_start INET,
  ip_range_end INET,
  community_string VARCHAR(255),                   -- Armazenado em texto (MVP), migrar para cofre
  snmp_version VARCHAR(10) DEFAULT '2c',          -- '1', '2c'
  snmp_port INTEGER DEFAULT 161,
  enabled BOOLEAN DEFAULT TRUE,
  interval_seconds INTEGER DEFAULT 300,           -- 5min default
  last_run_at TIMESTAMPTZ,
  last_run_duration_ms INTEGER,
  last_devices_found INTEGER DEFAULT 0,
  last_status VARCHAR(50),                        -- 'success', 'partial', 'error', 'disabled'
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, name)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_snmp_collectors_company
  ON snmp_collectors (company_id);

CREATE INDEX IF NOT EXISTS idx_snmp_collectors_enabled
  ON snmp_collectors (enabled) WHERE enabled = TRUE;

-- ============================================================
-- 3. Extensões em registered_agents para suportar Hyper-V
-- ============================================================
ALTER TABLE registered_agents ADD COLUMN IF NOT EXISTS hypervisor VARCHAR(50);
ALTER TABLE registered_agents ADD COLUMN IF NOT EXISTS os_version VARCHAR(100);

-- ============================================================
-- 4. Extensões em servers para suportar estrutura Host/VM
-- ============================================================
ALTER TABLE servers ADD COLUMN IF NOT EXISTS vm_parent_id UUID REFERENCES servers(id) ON DELETE SET NULL;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS is_virtual BOOLEAN DEFAULT FALSE;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS vm_cpu_percent DECIMAL(5,2);
ALTER TABLE servers ADD COLUMN IF NOT EXISTS vm_memory_percent DECIMAL(5,2);
ALTER TABLE servers ADD COLUMN IF NOT EXISTS vm_memory_total_mb INTEGER;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS vm_status VARCHAR(50);

-- ============================================================
-- 5. Extensões em network_devices para suportar SNMP
-- ============================================================
ALTER TABLE network_devices ADD COLUMN IF NOT EXISTS snmp_collector_id UUID REFERENCES snmp_collectors(id) ON DELETE SET NULL;
ALTER TABLE network_devices ADD COLUMN IF NOT EXISTS snmp_uptime BIGINT;
ALTER TABLE network_devices ADD COLUMN IF NOT EXISTS snmp_last_poll TIMESTAMPTZ;
ALTER TABLE network_devices ADD COLUMN IF NOT EXISTS snmp_sysdescr TEXT;
ALTER TABLE network_devices ADD COLUMN IF NOT EXISTS snmp_if_count INTEGER;
ALTER TABLE network_devices ADD COLUMN IF NOT EXISTS snmp_community VARCHAR(255);

-- ============================================================
-- 6. RLS Policies para novas tabelas
-- ============================================================
ALTER TABLE agent_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE snmp_collectors ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- agent_metrics: Admin gerencia, cliente não vê (interno)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'agent_metrics'
      AND policyname = 'Admins manage agent_metrics'
  ) THEN
    CREATE POLICY "Admins manage agent_metrics" ON agent_metrics FOR ALL USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;

  -- snmp_collectors: Admin gerencia, cliente não vê (interno)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'snmp_collectors'
      AND policyname = 'Admins manage snmp_collectors'
  ) THEN
    CREATE POLICY "Admins manage snmp_collectors" ON snmp_collectors FOR ALL USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;

  -- registered_agents: Adicionar policy para admins gerenciarem
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'registered_agents'
      AND policyname = 'Admins manage registered_agents'
  ) THEN
    CREATE POLICY "Admins manage registered_agents" ON registered_agents FOR ALL USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;
END $$;

-- ============================================================
-- 7. Comments para documentação
-- ============================================================
COMMENT ON TABLE agent_metrics IS 'Métricas históricas de agentes de monitoramento (host físico + VMs)';
COMMENT ON TABLE snmp_collectors IS 'Configuração de coletores SNMP por empresa';
COMMENT ON COLUMN agent_metrics.virtual_machines IS 'Array JSON de VMs: [{name, cpu_percent, memory_percent, status, ...}]';
COMMENT ON COLUMN snmp_collectors.community_string IS 'Community string SNMP. MVP: texto plano. Futuro: migrar para cofre (impl. 018)';
