-- Migration 018: Garante bypass de RLS para service_role em todas tabelas
-- Isso permite que admins criem outros admins, empresas, etc. sem restrições

-- 1. Política para profiles (CRÍTICO - bloqueia criação de admins)
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

-- 2. Política para companies
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

-- 3. Política para company_integrations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'company_integrations'
    AND policyname = 'Service role manages company_integrations'
  ) THEN
    CREATE POLICY "Service role manages company_integrations"
      ON company_integrations FOR ALL
      TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 4. Política para glpi_tickets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'glpi_tickets'
    AND policyname = 'Service role manages glpi_tickets'
  ) THEN
    CREATE POLICY "Service role manages glpi_tickets"
      ON glpi_tickets FOR ALL
      TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 5. Política para ms365_metrics
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ms365_metrics'
    AND policyname = 'Service role manages ms365_metrics'
  ) THEN
    CREATE POLICY "Service role manages ms365_metrics"
      ON ms365_metrics FOR ALL
      TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 6. Política para documents
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

-- 7. Política para monitoring_events
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'monitoring_events'
    AND policyname = 'Service role manages monitoring_events'
  ) THEN
    CREATE POLICY "Service role manages monitoring_events"
      ON monitoring_events FOR ALL
      TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 8. Política para servers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'servers'
    AND policyname = 'Service role manages servers'
  ) THEN
    CREATE POLICY "Service role manages servers"
      ON servers FOR ALL
      TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 9. Política para audit_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'audit_logs'
    AND policyname = 'Service role manages audit_logs'
  ) THEN
    CREATE POLICY "Service role manages audit_logs"
      ON audit_logs FOR ALL
      TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 10. Política para company_notification_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'company_notification_settings'
    AND policyname = 'Service role manages notification settings'
  ) THEN
    CREATE POLICY "Service role manages notification settings"
      ON company_notification_settings FOR ALL
      TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Comentário
COMMENT ON TABLE profiles IS 'Perfis de usuários (admin/client) - service_role tem bypass total de RLS';
