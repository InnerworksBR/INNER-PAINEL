-- Inicialização do schema monitoring
-- Executado automaticamente pelo PostgreSQL na primeira vez

-- Criar o schema monitoring
CREATE SCHEMA IF NOT EXISTS monitoring;

-- Garantir que o schema existe
GRANT USAGE ON SCHEMA monitoring TO PUBLIC;

-- Definir search_path padrão para as aplicações
ALTER DATABASE monitoring_dev SET search_path TO "$user", public, monitoring;
