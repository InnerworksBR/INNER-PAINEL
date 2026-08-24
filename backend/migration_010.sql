-- migration_010.sql
-- Agentes Nativos Inner: Tokens de Ativação, Agentes Registrados e Chaves de Ativos

-- 1. Tabela de Tokens de Ativação por Empresa
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

CREATE INDEX IF NOT EXISTS agent_activation_tokens_company_idx
  ON agent_activation_tokens (company_id, is_active);

-- 2. Tabela de Agentes Registrados (Endpoint & Coletor de Rede)
CREATE TABLE IF NOT EXISTS registered_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  agent_type TEXT NOT NULL CHECK (agent_type IN ('endpoint', 'collector')),
  asset_key TEXT NOT NULL UNIQUE,
  agent_secret TEXT NOT NULL,
  hostname TEXT NOT NULL,
  ip_address TEXT,
  os_info TEXT,
  version TEXT DEFAULT '1.0.0',
  status TEXT NOT NULL DEFAULT 'Online',
  last_heartbeat TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS registered_agents_company_idx
  ON registered_agents (company_id);

CREATE INDEX IF NOT EXISTS registered_agents_asset_key_idx
  ON registered_agents (asset_key);

-- 3. Atualizar tabelas de Servidores e Dispositivos de Rede com origem de monitoramento e chave de ativo
ALTER TABLE servers ADD COLUMN IF NOT EXISTS monitoring_source TEXT DEFAULT 'zabbix';
ALTER TABLE servers ADD COLUMN IF NOT EXISTS asset_key TEXT;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES registered_agents(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'servers_asset_key_unique'
  ) THEN
    ALTER TABLE servers ADD CONSTRAINT servers_asset_key_unique UNIQUE (asset_key);
  END IF;
END $$;

ALTER TABLE network_devices ADD COLUMN IF NOT EXISTS monitoring_source TEXT DEFAULT 'zabbix';
ALTER TABLE network_devices ADD COLUMN IF NOT EXISTS asset_key TEXT;
ALTER TABLE network_devices ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES registered_agents(id) ON DELETE SET NULL;
ALTER TABLE network_devices ADD COLUMN IF NOT EXISTS snmp_data JSONB DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'network_devices_asset_key_unique'
  ) THEN
    ALTER TABLE network_devices ADD CONSTRAINT network_devices_asset_key_unique UNIQUE (asset_key);
  END IF;
END $$;

-- 4. RLS Policies
ALTER TABLE agent_activation_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE registered_agents ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'agent_activation_tokens'
      AND policyname = 'Admins manage activation tokens'
  ) THEN
    CREATE POLICY "Admins manage activation tokens" ON agent_activation_tokens FOR ALL USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'registered_agents'
      AND policyname = 'Admins manage registered agents'
  ) THEN
    CREATE POLICY "Admins manage registered agents" ON registered_agents FOR ALL USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'registered_agents'
      AND policyname = 'Clients view own registered agents'
  ) THEN
    CREATE POLICY "Clients view own registered agents" ON registered_agents FOR SELECT USING (
      company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    );
  END IF;
END $$;
