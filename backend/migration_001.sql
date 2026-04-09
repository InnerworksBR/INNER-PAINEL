-- Migration 001: Correções de constraints + novas tabelas
-- Execute este SQL no console SQL do Supabase

-- ============================================================
-- 1. Adicionar UNIQUE constraints faltantes (FIX B6, B7, B8)
-- ============================================================

-- B6: glpi_tickets precisa de UNIQUE em glpi_id
ALTER TABLE glpi_tickets ADD CONSTRAINT glpi_tickets_glpi_id_unique UNIQUE (glpi_id);

-- B7: ms365_metrics precisa de UNIQUE composta
ALTER TABLE ms365_metrics ADD CONSTRAINT ms365_metrics_company_license_unique UNIQUE (company_id, license_name);

-- B8: servers precisa de UNIQUE composta
ALTER TABLE servers ADD CONSTRAINT servers_company_hostname_unique UNIQUE (company_id, hostname);

-- ============================================================
-- 2. Adicionar colunas extras em glpi_tickets
-- ============================================================

ALTER TABLE glpi_tickets ADD COLUMN IF NOT EXISTS priority TEXT;
ALTER TABLE glpi_tickets ADD COLUMN IF NOT EXISTS requester TEXT;
ALTER TABLE glpi_tickets ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE glpi_tickets ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE glpi_tickets ADD COLUMN IF NOT EXISTS resolution_date TIMESTAMP WITH TIME ZONE;

-- ============================================================
-- 3. Criar tabela network_devices
-- ============================================================

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

-- ============================================================
-- 4. Criar tabela system_settings
-- ============================================================

CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem ler/alterar configurações
CREATE POLICY "Admins manage settings" ON system_settings FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ============================================================
-- 5. Políticas RLS completas
-- ============================================================

-- ms365_metrics: Admin vê tudo, client só sua empresa
CREATE POLICY "Admins can do everything on ms365" ON ms365_metrics FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Clients view own ms365" ON ms365_metrics FOR SELECT USING (
  company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
);

-- servers: Admin vê tudo, client só sua empresa
CREATE POLICY "Admins can do everything on servers" ON servers FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Clients view own servers" ON servers FOR SELECT USING (
  company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
);

-- glpi_tickets: Admin vê tudo, client só sua empresa
CREATE POLICY "Admins can do everything on tickets" ON glpi_tickets FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Clients view own tickets" ON glpi_tickets FOR SELECT USING (
  company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
);

-- documents: Admin vê tudo, client só sua empresa
CREATE POLICY "Admins can do everything on documents" ON documents FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Clients view own documents" ON documents FOR SELECT USING (
  company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
);

-- network_devices: Admin vê tudo, client só sua empresa
CREATE POLICY "Admins can do everything on network" ON network_devices FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Clients view own network" ON network_devices FOR SELECT USING (
  company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
);

-- profiles: adicionar policy para clients verem seu próprio perfil
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (
  id = auth.uid()
);

-- Habilitar RLS nas tabelas que faltava
ALTER TABLE ms365_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE glpi_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
