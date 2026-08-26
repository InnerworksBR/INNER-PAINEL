-- =============================================================================
-- Migration 014: Adicionar coluna glpi_date_mod em glpi_tickets
-- =============================================================================
-- Resolver erro: "Could not find the 'glpi_date_mod' column of 'glpi_tickets'
-- in the schema cache" ao sincronizar tickets do GLPI.
--
-- O glpi-service.ts referencia esta coluna para armazenar a data de
-- modificação do ticket no GLPI (date_mod), mas a coluna não foi criada
-- na migração original.
-- =============================================================================

ALTER TABLE glpi_tickets
  ADD COLUMN IF NOT EXISTS glpi_date_mod TIMESTAMP WITH TIME ZONE;

-- Adicionar índice para melhorar queries por data de modificação
CREATE INDEX IF NOT EXISTS idx_glpi_tickets_glpi_date_mod
  ON glpi_tickets (company_id, glpi_date_mod DESC);

-- Comentário de documentação
COMMENT ON COLUMN glpi_tickets.glpi_date_mod IS 'Data de modificação do ticket no GLPI (date_mod), usada para detectar mudanças e ordenar por recente';

-- Garantir permissões do service_role
GRANT ALL ON TABLE glpi_tickets TO service_role;

-- Política de bypass RLS para service_role se ainda não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'glpi_tickets' AND policyname = 'service_role_bypass_glpi_tickets'
  ) THEN
    EXECUTE 'CREATE POLICY "service_role_bypass_glpi_tickets" ON glpi_tickets FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- Notificar PostgREST para recarregar o schema cache
NOTIFY pgrst, 'reload schema';