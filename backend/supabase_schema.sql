-- SQL Schema para Portal Inner (Supabase)

-- 1. Tabela de Empresas
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  cnpj TEXT UNIQUE NOT NULL,
  sector TEXT,
  status TEXT DEFAULT 'Ativo',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabela de Perfis de Usuário
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  role TEXT CHECK (role IN ('admin', 'client')) DEFAULT 'client',
  company_id UUID REFERENCES companies(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- 3. Tabela de Métricas MS365
CREATE TABLE ms365_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  license_name TEXT NOT NULL,
  total INTEGER DEFAULT 0,
  used INTEGER DEFAULT 0,
  available INTEGER DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Tabela de Servidores
CREATE TABLE servers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  hostname TEXT NOT NULL,
  cpu_usage FLOAT DEFAULT 0,
  memory_usage FLOAT DEFAULT 0,
  disk_usage FLOAT DEFAULT 0,
  status TEXT DEFAULT 'Online',
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Tabela de Chamados (GLPI)
CREATE TABLE glpi_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  glpi_id INTEGER NOT NULL,
  title TEXT,
  status TEXT,
  sla_status TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Tabela de Documentos
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT,
  file_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Políticas de RLS de exemplo
-- Administradores podem ler tudo
CREATE POLICY "Admins can do everything" ON companies FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Clientes só podem ver sua própria empresa
CREATE POLICY "Clients can view their own company" ON companies FOR SELECT USING (
  id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
);

-- 7. Tabela de Credenciais de Integração (Multi-Tenant)
CREATE TABLE company_integrations (
  company_id UUID PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  glpi_api_url TEXT,
  glpi_api_token TEXT,
  glpi_user_token TEXT,
  zabbix_api_url TEXT,
  zabbix_user TEXT,
  zabbix_password TEXT,
  ms_graph_tenant_id TEXT,
  ms_graph_client_id TEXT,
  ms_graph_client_secret TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Segurança para credenciais: Apenas admins podem ver ou alterar as chaves
ALTER TABLE company_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage integrations" ON company_integrations FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
