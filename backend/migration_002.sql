-- migration_002.sql
-- Refatoração da Integração do GLPI para Instância Única Backend

-- Adiciona a nova coluna de identificação da entidade do cliente no GLPI
ALTER TABLE company_integrations 
ADD COLUMN IF NOT EXISTS glpi_entity_id INTEGER;

-- Remove as colunas antigas que agora ficam centralizadas no .env
ALTER TABLE company_integrations 
DROP COLUMN IF EXISTS glpi_api_url,
DROP COLUMN IF EXISTS glpi_api_token,
DROP COLUMN IF EXISTS glpi_user_token;

-- Adiciona comentário para documentaçao da coluna
COMMENT ON COLUMN company_integrations.glpi_entity_id IS 'ID da entidade deste cliente no GLPI unificado da operadora';
