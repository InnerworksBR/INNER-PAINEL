-- =============================================================================
-- Migration 016: Adicionar coluna enabled_modules na tabela companies
-- =============================================================================
-- Esta coluna permite configurar quais módulos estão ativos para cada empresa.
-- O padrão inclui: dashboard, ms365 e chamados.
-- =============================================================================

-- Adicionar coluna enabled_modules como array de texto com valor padrão
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS enabled_modules TEXT[] DEFAULT ARRAY['dashboard', 'ms365', 'chamados'];

-- Adicionar comentário para documentação
COMMENT ON COLUMN companies.enabled_modules IS 'Módulos habilitados para o cliente: dashboard, ms365, servidores, rede, seguranca, inventario, chamados, documentacao';

-- Criar índice para consultas por módulos (opcional, para performance)
CREATE INDEX IF NOT EXISTS idx_companies_enabled_modules ON companies USING GIN (enabled_modules);

-- Recarregar schema cache do PostgREST
NOTIFY pgrst, 'reload schema';
