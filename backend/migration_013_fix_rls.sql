-- =============================================================================
-- Migration 013: Correção de RLS + Permissões Service Role
-- =============================================================================
-- Esta migração resolve os problemas de RLS que estavam bloqueando:
--   1. Importação de documentos (tabela `documents`)
--   2. Upload de relatórios Zero Trust (tabela `security_rereports`)
--   3. Salvamento de integrações de clientes (tabela `company_integrations`)
--
-- Estratégia:
--   - Garante GRANTs explícitos para o role `service_role` em todas as
--     tabelas operacionais (service_role SEMPRE bypassa RLS por padrão
--     no Postgres, mas algumas migrações anteriores desabilitaram isso).
--   - Adiciona políticas permissivas para `service_role` por garantia.
--   - Cria índice/garante RLS na tabela `company_integrations` se ainda
--     não tiver políticas.
-- =============================================================================

-- 1. Garantir privilégios totais ao service_role em todas as tabelas
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO service_role;
GRANT USAGE ON SCHEMA public TO service_role;

-- 2. Storage.objects - garantir permissão para service_role manipular bucket documents
GRANT ALL PRIVILEGES ON storage.objects TO service_role;
GRANT ALL PRIVILEGES ON storage.buckets TO service_role;

-- 3. Tabela company_integrations - habilitar RLS e criar política para service_role
ALTER TABLE company_integrations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'company_integrations'
    AND policyname = 'Service role manages company integrations'
  ) THEN
    CREATE POLICY "Service role manages company integrations"
      ON company_integrations FOR ALL
      TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 4. Política explícita de bypass para service_role em documents
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'documents'
    AND policyname = 'Service role manages documents'
  ) THEN
    CREATE POLICY "Service role manages documents"
      ON documents FOR ALL
      TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 5. Política explícita de bypass para service_role em security_reports
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'security_reports'
    AND policyname = 'Service role manages security reports'
  ) THEN
    CREATE POLICY "Service role manages security reports"
      ON security_reports FOR ALL
      TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 6. Política explícita de bypass para service_role em admin_audit_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'admin_audit_logs'
    AND policyname = 'Service role manages audit logs'
  ) THEN
    CREATE POLICY "Service role manages audit logs"
      ON admin_audit_logs FOR ALL
      TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 7. Política explícita de bypass para service_role em companies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'companies'
    AND policyname = 'Service role manages companies'
  ) THEN
    CREATE POLICY "Service role manages companies"
      ON companies FOR ALL
      TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 8. Política explícita de bypass para service_role em profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
    AND policyname = 'Service role manages profiles'
  ) THEN
    CREATE POLICY "Service role manages profiles"
      ON profiles FOR ALL
      TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 9. Garantir permissões de leitura/escrita no schema de Storage
GRANT ALL ON storage.objects TO service_role;
GRANT ALL ON storage.buckets TO service_role;

-- 10. Comentário para documentação
COMMENT ON TABLE company_integrations IS 'Configurações de integração por empresa (Zabbix, MS365, GLPI) - service_role tem bypass total';